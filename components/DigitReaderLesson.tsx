"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { digitGallery, type DigitPrediction } from "@/lib/browser-digit-model";
import { handwrittenDigitExercise, TRAIN_MODEL_COMMAND } from "@/lib/exercise";
import { DIGIT_LAB_LOGIN_PATH } from "@/lib/routes";
import {
  DigitPlayground,
  type CustomModelStatus,
  type PlaygroundModel,
} from "./DigitPlayground";
import type {
  TerminalConnectionState,
  TerminalController,
} from "./InteractiveTerminal";
import { DataExplorer } from "./DataExplorer";
import styles from "./DigitReaderLesson.module.css";

const CodeEditor = dynamic(
  () => import("./CodeEditor").then((module) => module.CodeEditor),
  { ssr: false, loading: () => <PanelLoading label="Loading Python editor…" /> },
);

const InteractiveTerminal = dynamic(
  () => import("./InteractiveTerminal").then((module) => module.InteractiveTerminal),
  { ssr: false, loading: () => <PanelLoading label="Opening terminal…" /> },
);

const DRAFT_KEY = "leetml-digit-lab-draft-v2";

type DigitReaderLessonProps = {
  authenticated: boolean;
  authConfigured: boolean;
};

type ModelStatusResponse =
  | { status: "missing" }
  | { status: "ready"; accuracy: number; trainedAt: string }
  | { error: string };

type SaveResponse = { status: "saved" } | { error: string };
type ResetResponse = { status: "reset" } | { error: string };
type PredictResponse = DigitPrediction | { error: string };

function PanelLoading({ label }: { label: string }) {
  return <div className={styles.panelLoading}>{label}</div>;
}

function isModelStatusResponse(value: unknown): value is ModelStatusResponse {
  if (!value || typeof value !== "object") return false;
  if ("error" in value) return typeof value.error === "string";
  if (!("status" in value)) return false;
  if (value.status === "missing") return true;
  return (
    value.status === "ready" &&
    "accuracy" in value &&
    typeof value.accuracy === "number" &&
    "trainedAt" in value &&
    typeof value.trainedAt === "string"
  );
}

function isSaveResponse(value: unknown): value is SaveResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      (("status" in value && value.status === "saved") ||
        ("error" in value && typeof value.error === "string")),
  );
}

function isResetResponse(value: unknown): value is ResetResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      (("status" in value && value.status === "reset") ||
        ("error" in value && typeof value.error === "string")),
  );
}

function isPredictResponse(value: unknown): value is PredictResponse {
  if (!value || typeof value !== "object") return false;
  if ("error" in value) return typeof value.error === "string";
  if (!("digit" in value) || typeof value.digit !== "number") return false;
  if (!("neighbors" in value) || value.neighbors === undefined) return true;
  return (
    Array.isArray(value.neighbors) &&
    value.neighbors.length === 3 &&
    value.neighbors.every(
      (neighbor) =>
        neighbor &&
        typeof neighbor === "object" &&
        "label" in neighbor &&
        typeof neighbor.label === "number" &&
        "distance" in neighbor &&
        typeof neighbor.distance === "number" &&
        "pixels" in neighbor &&
        Array.isArray(neighbor.pixels) &&
        neighbor.pixels.length === 64,
    )
  );
}

function MiniDigit({ pixels }: { pixels: readonly number[] }) {
  return (
    <div className={styles.miniDigit} aria-hidden="true">
      {pixels.map((value, index) => (
        <span key={index} style={{ backgroundColor: `rgba(249, 251, 246, ${value / 16})` }} />
      ))}
    </div>
  );
}

function scrollToSection(selector: string) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector(selector)?.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
  });
}

export function DigitReaderLesson({
  authenticated,
  authConfigured,
}: DigitReaderLessonProps) {
  const [code, setCode] = useState(() =>
    typeof window === "undefined"
      ? handwrittenDigitExercise.starterCode
      : window.sessionStorage.getItem(DRAFT_KEY) ?? handwrittenDigitExercise.starterCode,
  );
  const [model, setModel] = useState<PlaygroundModel>("builtin");
  const [modelStatus, setModelStatus] = useState<CustomModelStatus>(
    authenticated ? { state: "checking" } : { state: "missing" },
  );
  const [labStarted, setLabStarted] = useState(false);
  const [terminalState, setTerminalState] =
    useState<TerminalConnectionState>("connecting");
  const [pendingTraining, setPendingTraining] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [activeHintIndex, setActiveHintIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const terminalController = useRef<TerminalController | null>(null);

  const refreshModelStatus = useCallback(async () => {
    if (!authenticated) {
      setModelStatus({ state: "missing" });
      return { state: "missing" } as const;
    }

    setModelStatus({ state: "checking" });
    try {
      const response = await fetch("/api/model/status", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign(DIGIT_LAB_LOGIN_PATH);
        return { state: "missing" } as const;
      }
      const payload: unknown = await response.json();
      if (!isModelStatusResponse(payload)) throw new Error("Model status returned invalid data.");
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Could not check your model.");
      }

      const nextStatus: CustomModelStatus =
        payload.status === "ready"
          ? { state: "ready", accuracy: payload.accuracy, trainedAt: payload.trainedAt }
          : { state: "missing" };
      setModelStatus(nextStatus);
      return nextStatus;
    } catch {
      setModelStatus({ state: "missing" });
      return { state: "missing" } as const;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    const timeout = window.setTimeout(() => void refreshModelStatus(), 0);
    return () => window.clearTimeout(timeout);
  }, [authenticated, refreshModelStatus]);

  const predictCustom = useCallback(async (pixels: readonly number[]) => {
    const response = await fetch("/api/model/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pixels }),
    });

    if (response.status === 401) {
      window.location.assign(DIGIT_LAB_LOGIN_PATH);
      throw new Error("Sign in again to use your model.");
    }

    const payload: unknown = await response.json();
    if (!isPredictResponse(payload)) throw new Error("The model returned an unexpected response.");
    if (!response.ok || "error" in payload) {
      if (response.status === 409) {
        setModelStatus({ state: "missing" });
        setModel("builtin");
      }
      throw new Error("error" in payload ? payload.error : "Your model could not predict.");
    }
    return payload;
  }, []);

  const trainModel = useCallback(async () => {
    const controller = terminalController.current;
    if (!controller || (terminalState !== "ready" && terminalState !== "busy")) return;

    setTraining(true);
    setTrainingError(null);
    setModelStatus({ state: "missing" });
    setModel("builtin");

    try {
      if (terminalState === "busy") await controller.interruptAndWait();

      const response = await fetch("/api/solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.status === 401) {
        window.sessionStorage.setItem(DRAFT_KEY, code);
        window.location.assign(DIGIT_LAB_LOGIN_PATH);
        return;
      }

      const payload: unknown = await response.json();
      if (!isSaveResponse(payload)) throw new Error("Saving Python returned invalid data.");
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Could not save solution.py.");
      }

      await controller.sendCommandAndWait(TRAIN_MODEL_COMMAND);
      const nextStatus = await refreshModelStatus();
      if (nextStatus.state !== "ready") {
        throw new Error("No usable model was created. Read the terminal output, then try again.");
      }

      setModel("custom");
      controller.writeNotice("My model is now unlocked in the playground.");
      scrollToSection("#playground");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Training could not finish.";
      setTrainingError(message);
      controller.writeNotice(message);
    } finally {
      setTraining(false);
    }
  }, [code, refreshModelStatus, terminalState]);

  useEffect(() => {
    if (!pendingTraining || terminalState !== "ready" || !terminalController.current) return;
    const timeout = window.setTimeout(() => {
      setPendingTraining(false);
      void trainModel();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pendingTraining, terminalState, trainModel]);

  const changeCode = useCallback((nextCode: string) => {
    setCode(nextCode);
    window.sessionStorage.setItem(DRAFT_KEY, nextCode);
  }, []);

  const handleTerminalControllerChange = useCallback((controller: TerminalController | null) => {
    terminalController.current = controller;
  }, []);

  function restoreInitialWorkspace() {
    terminalController.current = null;
    window.sessionStorage.removeItem(DRAFT_KEY);
    setCode(handwrittenDigitExercise.starterCode);
    setModel("builtin");
    setModelStatus({ state: "missing" });
    setLabStarted(false);
    setTerminalState("connecting");
    setPendingTraining(false);
    setTraining(false);
    setTrainingError(null);
    setActiveHintIndex(0);
    setCopied(false);
    setWorkspaceVersion((version) => version + 1);
  }

  async function resetWorkspace() {
    const confirmed = window.confirm(
      "Reset this lab? This permanently deletes your current code, trained model, and private sandbox, then restores the starter code.",
    );
    if (!confirmed) return;

    if (!authenticated) {
      restoreInitialWorkspace();
      return;
    }

    setResetting(true);
    setTrainingError(null);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      if (response.status === 401) {
        restoreInitialWorkspace();
        window.location.assign(DIGIT_LAB_LOGIN_PATH);
        return;
      }

      const payload: unknown = await response.json();
      if (!isResetResponse(payload)) throw new Error("Reset returned invalid data.");
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "The lab could not be reset.");
      }
      restoreInitialWorkspace();
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : "The lab could not be reset.");
    } finally {
      setResetting(false);
    }
  }

  function requestLab(startTraining: boolean) {
    window.sessionStorage.setItem(DRAFT_KEY, code);
    if (!authenticated) {
      window.location.assign(DIGIT_LAB_LOGIN_PATH);
      return;
    }
    if (!authConfigured) return;

    if (!labStarted) {
      setPendingTraining(startTraining);
      setLabStarted(true);
      return;
    }
    if (startTraining) {
      if (terminalState === "ready" || terminalState === "busy") {
        void trainModel();
      } else {
        setPendingTraining(true);
      }
    }
  }

  async function copyCompleteCode() {
    await navigator.clipboard.writeText(handwrittenDigitExercise.completeCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  const terminalStatus = training
    ? "Training model"
    : terminalState === "ready"
      ? "Terminal ready"
      : terminalState === "busy"
        ? "Command running"
        : terminalState === "connecting"
          ? "Starting lab"
          : "Terminal disconnected";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Handwriting Reader Lab home">
          <span className={styles.brandMark}>HR</span>
          <span>Handwriting Reader Lab</span>
        </Link>
        <nav aria-label="Lesson sections">
          <a href="#problem">Problem</a>
          <a href="#playground">Playground</a>
          <a href="#do-it-yourself">Do it yourself</a>
        </nav>
        {authenticated ? (
          <form action="/api/logout" method="post">
            <button className={styles.headerButton} type="submit">Sign out</button>
          </form>
        ) : (
          <Link className={styles.headerButton} href={DIGIT_LAB_LOGIN_PATH}>Unlock lab</Link>
        )}
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>Learning from examples · Lab 01</p>
          <h1>Can a machine learn to read your handwriting?</h1>
          <p>
            First try ordinary programming: write the recognition rules yourself. Then discover
            machine learning—a way for a computer to build those rules from examples and correct
            answers.
          </p>
          <div className={styles.labGoal}>
            <span>Your goal</span>
            <p>
              Work through the lab, understand the ideas, and train your own model. Test it with
              the supplied sample images and your own handwriting. Find at least one handwritten
              digit it recognizes correctly—and at least one it gets wrong.
            </p>
          </div>
          <a className={styles.heroAction} href="#problem">
            Begin the experiment <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className={styles.heroDigits} aria-hidden="true">
          {[digitGallery[5], digitGallery[8], digitGallery[15]].map((sample, index) => (
            <div className={styles.floatingDigit} key={sample.id}>
              <MiniDigit pixels={sample.pixels} />
              <span>{index === 0 ? "pixels" : index === 1 ? "examples" : "answer"}</span>
            </div>
          ))}
          <svg viewBox="0 0 520 360">
            <path d="M95 94 C220 20 305 185 436 104" />
            <path d="M103 264 C240 330 300 175 430 274" />
          </svg>
        </div>
      </section>

      <section className={styles.problemSection} id="problem" aria-labelledby="problem-title">
        <div className={styles.sectionNumber}>01</div>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>The problem</p>
          <h2 id="problem-title">Write the rules. Every single one.</h2>
          <p>
            A parcel sorter receives an 8 × 8 image and must return a digit from 0 to 9. Ordinary
            programs need rules written in advance. What rule finds a seven when the writer tilts
            it, loops it, or presses twice as hard?
          </p>
        </div>

        <div className={styles.ruleChallenge}>
          <div className={styles.challengeImages}>
            {[digitGallery[14], digitGallery[15], digitGallery[6]].map((sample) => (
              <MiniDigit key={sample.id} pixels={sample.pixels} />
            ))}
            <span>Same job. Wildly different pixels.</span>
          </div>
          <pre><code>{`def recognize(pixels):
    if ???:
        return 7
    # Add a rule for every style,
    # wobble, smudge, and surprise.`}</code></pre>
          <div className={styles.challengeVerdict}>
            <span aria-hidden="true">×</span>
            <div>
              <strong>You could keep adding rules forever.</strong>
              <p>The hard part is not Python syntax. It is knowing which patterns matter.</p>
            </div>
          </div>
        </div>

        <div className={styles.programmingComparison}>
          <div className={styles.comparisonIntro}>
            <p className={styles.eyebrow}>Programming compared with machine learning</p>
            <h3>Who writes the rules?</h3>
            <p>
              <strong>Machine learning (ML)</strong> is a way to create a program by giving a
              computer examples and correct answers, instead of asking a person to write every rule.
            </p>
          </div>
          <div className={styles.comparisonCards}>
            <article>
              <span>Ordinary programming</span>
              <h4>A person writes the rules.</h4>
              <p>
                You describe exactly how to turn the information coming in into an answer. The
                computer follows those instructions without learning from past examples.
              </p>
              <div className={styles.comparisonFlow}>
                <code>your rules</code><b>+</b><code>new image</code><b>→</b><code>answer</code>
              </div>
            </article>
            <article className={styles.mlComparisonCard}>
              <span>Machine learning</span>
              <h4>The computer builds rules from examples.</h4>
              <p>
                A <strong>learning algorithm</strong> is a recipe for finding useful patterns.
                <strong> Training</strong> means running that recipe on examples and their correct
                answers. The saved result is a <strong>model</strong>. A model&apos;s answer for a new
                example is called a <strong>prediction</strong>.
              </p>
              <div className={styles.comparisonFlow}>
                <code>examples + answers</code><b>→</b><code>training</code><b>→</b><code>model</code>
              </div>
            </article>
          </div>
        </div>

        <div className={styles.dataLesson} aria-labelledby="data-lesson-title">
          <div className={styles.dataLessonIntro}>
            <p className={styles.eyebrow}>The data · decoded</p>
            <h3 id="data-lesson-title">Think of it as studying for a test.</h3>
            <p>
              <strong>Data</strong> is the collection of examples a computer can study or answer.
              A <strong>feature</strong> is one measured detail about an example; here, each of the
              64 grayscale pixel values is one feature. <strong>Ground truth</strong> is the trusted
              correct answer supplied by a human teacher. In <strong>Python</strong>, the programming
              language used in this lab, <code>X</code> holds the image features and <code>y</code>
              holds their ground-truth answers. Each stored answer is also called a
              <strong> label</strong>.
            </p>
          </div>

          <div className={styles.dataBasics}>
            <article>
              <code>X</code>
              <strong>The questions</strong>
              <p>1,797 images. Each row contains the 64 pixel values for one digit.</p>
            </article>
            <span aria-hidden="true">+</span>
            <article>
              <code>y</code>
              <strong>The answer key</strong>
              <p>1,797 labels. Each label tells us which digit its matching image shows.</p>
            </article>
          </div>

          <div className={styles.studySplit}>
            <article className={styles.trainPile}>
              <div className={styles.pileHeading}>
                <span>Study time</span>
                <strong>Learn with the answers open</strong>
              </div>
              <div className={styles.variablePair}>
                <code>X_train</code>
                <b>+</b>
                <code>y_train</code>
              </div>
              <p>
                During training, the learning algorithm receives 1,347 image-questions <em>and</em>
                their correct answers. It may use both piles to learn which features are useful.
              </p>
            </article>

            <article className={styles.testPile}>
              <div className={styles.pileHeading}>
                <span>Closed-book test</span>
                <strong>Answer first, then get scored</strong>
              </div>
              <div className={styles.variablePair}>
                <code>X_test</code>
                <b>→</b>
                <code>prediction</code>
              </div>
              <p>
                The model sees 450 new image-questions without their answers. The teacher keeps
                <code> y_test</code> hidden, compares it with the predictions, and calculates the
                score.
              </p>
            </article>
          </div>

          <p className={styles.namingNote}>
            Why lowercase <code>y</code>? It is the usual spelling in <strong>scikit-learn</strong>,
            the Python toolkit we use for machine learning: capital <code>X</code> is a table of many
            features; lowercase <code>y</code> is one answer for each row.
          </p>

          <DataExplorer />
        </div>

        <div className={styles.learningReveal}>
          <div>
            <p className={styles.eyebrow}>Meet the learning algorithm</p>
            <h3>Find examples that look most similar.</h3>
            <p>
              <strong>K-nearest neighbours (KNN)</strong> is a learning algorithm that remembers the
              study data. The letter <strong>k</strong> means how many nearby examples may vote. We
              use k = 3. For a new image, KNN calculates a <strong>distance</strong>—one number that
              measures pixel difference—to every study image. Smaller distance means more similar.
            </p>
          </div>
          <div className={styles.learningFlow} aria-label="Three-nearest-neighbours prediction flow">
            <div><span>1</span><strong>New image</strong><small>64 features</small></div>
            <b aria-hidden="true">→</b>
            <div><span>2</span><strong>3 closest</strong><small>smallest distances</small></div>
            <b aria-hidden="true">→</b>
            <div className={styles.flowModel}><span>3</span><strong>Vote</strong><small>predict a label</small></div>
          </div>
        </div>
      </section>

      <DigitPlayground
        key={workspaceVersion}
        authenticated={authenticated}
        customModelStatus={modelStatus}
        model={model}
        onModelChange={setModel}
        predictCustom={predictCustom}
      />

      <section className={styles.labSection} id="do-it-yourself" aria-labelledby="lab-title">
        <div className={styles.sectionNumber}>03</div>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Do it yourself</p>
          <h2 id="lab-title">Train the model behind the menu.</h2>
          <p>
            A <strong>classifier</strong> is a model that chooses a category—here, one digit from 0
            to 9. Complete the three steps below to build one. When you start, the lab opens a
            <strong> sandbox</strong>, a temporary private computer, and a <strong>terminal</strong>,
            a text window for running Python commands.
          </p>
          <p>
            In the starter code, <code>digits.data</code> contains the image features from
            <code> X</code>, while <code>digits.target</code> contains the correct labels from
            <code> y</code>. If you get stuck, use the <strong>Hints</strong> beside the editor. Move
            through them one at a time; the final hint contains complete code. Copying it is allowed,
            but we recommend typing it yourself while using the hint as a reference.
          </p>
        </div>

        <ol className={styles.labSteps} aria-label="Build your model in three steps">
          <li>
            <span>1</span>
            <div><strong>Split the examples.</strong><p>Keep test answers out of training so the final score is honest.</p></div>
          </li>
          <li>
            <span>2</span>
            <div><strong>Fit the classifier.</strong><p>In scikit-learn, <code>fit</code> means let the model learn from <code>X_train</code> and <code>y_train</code>.</p></div>
          </li>
          <li>
            <span>3</span>
            <div><strong>Save, then run.</strong><p>Save the learned model as <code>model.joblib</code> so the playground can load it, then press the green button to run and score your code.</p></div>
          </li>
        </ol>

        <div className={styles.labLayout}>
          <div className={styles.editorColumn}>
            <div className={styles.toolHeader}>
              <div>
                <span className={styles.pythonBadge}>Py</span>
                <strong>solution.py</strong>
              </div>
              <div className={styles.toolActions}>
                <button
                  className={styles.resetButton}
                  type="button"
                  disabled={training || pendingTraining || resetting}
                  onClick={() => void resetWorkspace()}
                >
                  {resetting ? "Resetting…" : "Reset lab"}
                </button>
                <button
                  className={styles.trainButton}
                  type="button"
                  disabled={training || pendingTraining || resetting}
                  onClick={() => requestLab(true)}
                >
                  <span aria-hidden="true">▶</span>
                  {training
                    ? "Training…"
                    : pendingTraining
                      ? "Starting lab…"
                      : "Train my model"}
                </button>
              </div>
            </div>
            <div className={styles.editorFrame}>
              <CodeEditor key={workspaceVersion} value={code} onChange={changeCode} />
            </div>
          </div>

          <aside className={styles.hints} aria-label="Progressive coding hints">
            <div className={styles.hintsHeader}>
              <span>Hints</span>
              <strong>
                {activeHintIndex + 1} / {handwrittenDigitExercise.hints.length}
              </strong>
            </div>
            <article className={styles.hintCard}>
              <span>{String(activeHintIndex + 1).padStart(2, "0")}</span>
              <h3>{handwrittenDigitExercise.hints[activeHintIndex].title}</h3>
              <p>{handwrittenDigitExercise.hints[activeHintIndex].body}</p>
              <pre><code>{handwrittenDigitExercise.hints[activeHintIndex].code}</code></pre>
              {activeHintIndex === handwrittenDigitExercise.hints.length - 1 ? (
                <div className={styles.hintActions}>
                  <button type="button" onClick={copyCompleteCode}>
                    {copied ? "Copied" : "Copy complete code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => changeCode(handwrittenDigitExercise.completeCode)}
                  >
                    Use in editor
                  </button>
                </div>
              ) : null}
            </article>
            <nav className={styles.hintNavigation} aria-label="Choose a coding hint">
              <button
                type="button"
                disabled={activeHintIndex === 0}
                onClick={() => setActiveHintIndex((index) => Math.max(0, index - 1))}
              >
                <span aria-hidden="true">←</span> Previous hint
              </button>
              <button
                type="button"
                disabled={activeHintIndex === handwrittenDigitExercise.hints.length - 1}
                onClick={() =>
                  setActiveHintIndex((index) =>
                    Math.min(handwrittenDigitExercise.hints.length - 1, index + 1),
                  )
                }
              >
                Next hint <span aria-hidden="true">→</span>
              </button>
            </nav>
          </aside>

          <div className={styles.terminalCard}>
            <div className={styles.toolHeader}>
              <div>
                <span className={styles.terminalIcon} aria-hidden="true">›_</span>
                <strong>Training terminal</strong>
              </div>
              <span className={styles.terminalStatus}>
                <i className={terminalState === "ready" ? styles.readyStatus : undefined} />
                {labStarted ? terminalStatus : "Not started"}
              </span>
            </div>
            <div className={styles.terminalFrame}>
              {!authConfigured ? (
                <div className={styles.labGate}>
                  <span className={styles.gateIcon}>!</span>
                  <h3>Authentication is not configured</h3>
                  <p>Add the required environment variables before starting the protected lab.</p>
                </div>
              ) : !authenticated ? (
                <div className={styles.labGate}>
                  <span className={styles.gateIcon}>⌁</span>
                  <h3>The lesson is free. Compute is protected.</h3>
                  <p>Enter the family passphrase before starting a private sandbox or using My model.</p>
                  <button type="button" onClick={() => requestLab(false)}>Unlock Python lab</button>
                </div>
              ) : !labStarted ? (
                <div className={styles.labGate}>
                  <span className={styles.gateIcon}>▶</span>
                  <h3>Ready when you are</h3>
                  <p>Start the lab to create or reconnect your temporary private computer.</p>
                  <button type="button" onClick={() => requestLab(false)}>Start lab</button>
                </div>
              ) : (
                <InteractiveTerminal
                  onControllerChange={handleTerminalControllerChange}
                  onStateChange={setTerminalState}
                />
              )}
            </div>
          </div>
        </div>

        {trainingError ? <p className={styles.trainingError} role="alert">{trainingError}</p> : null}
        {modelStatus.state === "ready" ? (
          <div className={styles.modelUnlocked}>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>My model is ready</strong>
              <p>
                It scored {(modelStatus.accuracy * 100).toFixed(1)}% on 450 unseen images and is now
                available in the playground.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setModel("custom");
                scrollToSection("#playground");
              }}
            >
              Test my model
            </button>
          </div>
        ) : null}
      </section>

      <footer className={styles.footer}>
        <span className={styles.brandMark}>HR</span>
        <div><strong>One model trained. Many experiments ahead.</strong><small>More learning labs are being built.</small></div>
        <a href="#problem">Run the lesson again ↑</a>
      </footer>
    </main>
  );
}
