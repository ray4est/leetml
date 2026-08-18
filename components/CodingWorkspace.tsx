"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  TerminalConnectionState,
  TerminalController,
} from "./InteractiveTerminal";
import styles from "./CodingWorkspace.module.css";

const CodeEditor = dynamic(
  () => import("./CodeEditor").then((module) => module.CodeEditor),
  { ssr: false, loading: () => <PanelLoading label="Loading editor…" /> },
);

const InteractiveTerminal = dynamic(
  () => import("./InteractiveTerminal").then((module) => module.InteractiveTerminal),
  { ssr: false, loading: () => <PanelLoading label="Loading terminal…" /> },
);

type Exercise = {
  title: string;
  eyebrow: string;
  description: string;
  functionSignature: string;
  requirements: readonly string[];
  tip: string;
  sampleImage: readonly number[];
  sampleLabel: number;
  starterCode: string;
};

type RunAction = "interrupting" | "saving" | "launching" | null;

type SaveResponse =
  | {
      status: "saved";
    }
  | {
      error: string;
    };

function PanelLoading({ label }: { label: string }) {
  return <div className={styles.loadingPanel}>{label}</div>;
}

function isSaveResponse(value: unknown): value is SaveResponse {
  if (!value || typeof value !== "object") return false;
  return (
    ("status" in value && value.status === "saved") ||
    ("error" in value && typeof value.error === "string")
  );
}

export function CodingWorkspace({ exercise }: { exercise: Exercise }) {
  const [code, setCode] = useState(exercise.starterCode);
  const [terminalState, setTerminalState] =
    useState<TerminalConnectionState>("connecting");
  const [runAction, setRunAction] = useState<RunAction>(null);
  const terminalController = useRef<TerminalController | null>(null);

  const handleControllerChange = useCallback((controller: TerminalController | null) => {
    terminalController.current = controller;
  }, []);

  const handleTerminalStateChange = useCallback((state: TerminalConnectionState) => {
    setTerminalState(state);
  }, []);

  const displayedStatus = runAction ?? terminalState;
  const statusLabel = useMemo(() => {
    if (displayedStatus === "connecting") return "Connecting";
    if (displayedStatus === "busy") return "Running";
    if (displayedStatus === "interrupting") return "Interrupting";
    if (displayedStatus === "saving") return "Saving";
    if (displayedStatus === "launching") return "Starting tests";
    if (displayedStatus === "disconnected") return "Disconnected";
    if (displayedStatus === "error") return "Error";
    return "Ready";
  }, [displayedStatus]);

  const canRunTests =
    runAction === null && (terminalState === "ready" || terminalState === "busy");

  async function runTests() {
    const controller = terminalController.current;
    if (!controller || !canRunTests) return;

    try {
      setRunAction("interrupting");
      await controller.interruptAndWait();

      setRunAction("saving");
      const response = await fetch("/api/solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.status === 401) {
        window.location.replace("/login?reason=expired");
        return;
      }

      const payload: unknown = await response.json();
      if (!isSaveResponse(payload)) {
        throw new Error("The source service returned an unexpected response.");
      }
      if (!response.ok || !("status" in payload)) {
        throw new Error("error" in payload ? payload.error : "Unable to save solution.py.");
      }

      setRunAction("launching");
      await controller.sendCommand(
        "python -m pytest -q -s --disable-warnings --maxfail=1",
      );
    } catch (error) {
      controller.writeNotice(
        error instanceof Error ? error.message : "Unable to start the test run.",
      );
    } finally {
      setRunAction(null);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <div className={styles.mark} aria-hidden="true">
            LM
          </div>
          <div>
            <div className={styles.brand}>leetml</div>
            <div className={styles.headerExercise}>{exercise.title}</div>
          </div>
        </div>

        <div className={styles.actions}>
          <div
            className={`${styles.status} ${styles[`status_${displayedStatus}`]}`}
            aria-live="polite"
          >
            <span className={styles.statusDot} aria-hidden="true" />
            {statusLabel}
          </div>
          <button
            className={styles.runButton}
            type="button"
            onClick={runTests}
            disabled={!canRunTests}
          >
            <span className={styles.playIcon} aria-hidden="true">
              ▶
            </span>
            {runAction === "interrupting"
              ? "Stopping command…"
              : runAction === "saving"
                ? "Saving…"
                : runAction === "launching"
                  ? "Starting tests…"
                  : terminalState === "connecting"
                    ? "Connecting…"
                    : "Run tests"}
          </button>
          <form action="/api/logout" method="post">
            <button className={styles.signOutButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className={styles.workspace}>
        <aside className={`${styles.panel} ${styles.instructions}`}>
          <div className={styles.panelHeader}>
            <span>Problem</span>
            <span className={styles.exerciseNumber}>01</span>
          </div>
          <div className={styles.instructionsBody}>
            <p className={styles.eyebrow}>{exercise.eyebrow}</p>
            <h1>{exercise.title}</h1>
            <p className={styles.description}>{exercise.description}</p>

            <h2>Example training image</h2>
            <div className={styles.digitExample}>
              <div
                className={styles.digitGrid}
                role="img"
                aria-label={`An 8 by 8 grayscale image of handwritten digit ${exercise.sampleLabel}`}
              >
                {exercise.sampleImage.map((brightness, index) => (
                  <span
                    className={styles.digitPixel}
                    key={index}
                    style={{
                      backgroundColor: `rgba(248, 250, 252, ${0.04 + (brightness / 16) * 0.96})`,
                    }}
                  />
                ))}
              </div>
              <div className={styles.digitLabel}>
                <span>Known label</span>
                <strong>{exercise.sampleLabel}</strong>
              </div>
            </div>

            <h2>Function</h2>
            <code className={styles.signature}>{exercise.functionSignature}</code>

            <h2>Requirements</h2>
            <ul className={styles.requirements}>
              {exercise.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>

            <div className={styles.tip}>
              <span className={styles.tipLabel}>Tip</span>
              {exercise.tip}
            </div>
          </div>
        </aside>

        <section className={`${styles.panel} ${styles.editorPanel}`} aria-label="Code editor">
          <div className={styles.panelHeader}>
            <div className={styles.fileTab}>
              <span className={styles.pythonIcon} aria-hidden="true">
                Py
              </span>
              solution.py
            </div>
            <span className={styles.language}>Python 3.12</span>
          </div>
          <div className={styles.panelContent}>
            <CodeEditor value={code} onChange={setCode} />
          </div>
        </section>

        <section className={`${styles.panel} ${styles.consolePanel}`} aria-label="Terminal">
          <div className={styles.panelHeader}>
            <span>Terminal</span>
            <span className={styles.readOnly}>Interactive shell</span>
          </div>
          <div className={styles.panelContent}>
            <InteractiveTerminal
              onControllerChange={handleControllerChange}
              onStateChange={handleTerminalStateChange}
            />
          </div>
        </section>
      </section>
    </main>
  );
}
