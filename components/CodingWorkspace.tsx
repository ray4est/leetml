"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import styles from "./CodingWorkspace.module.css";

const CodeEditor = dynamic(
  () => import("./CodeEditor").then((module) => module.CodeEditor),
  { ssr: false, loading: () => <PanelLoading label="Loading editor…" /> },
);

const OutputConsole = dynamic(
  () => import("./OutputConsole").then((module) => module.OutputConsole),
  { ssr: false, loading: () => <PanelLoading label="Loading console…" /> },
);

type RunStatus = "ready" | "running" | "passed" | "failed" | "error";

type Exercise = {
  title: string;
  eyebrow: string;
  description: string;
  functionSignature: string;
  requirements: readonly string[];
  starterCode: string;
};

type RunResponse =
  | {
      status: "passed" | "failed";
      output: string;
      exitCode: number;
      durationMs: number;
    }
  | {
      status: "error";
      output: string;
      message: string;
      durationMs: number;
    };

function PanelLoading({ label }: { label: string }) {
  return <div className={styles.loadingPanel}>{label}</div>;
}

function isRunResponse(value: unknown): value is RunResponse {
  if (!value || typeof value !== "object" || !("status" in value)) {
    return false;
  }

  const status = value.status;
  return status === "passed" || status === "failed" || status === "error";
}

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1_000).toFixed(1)} s`;
}

export function CodingWorkspace({ exercise }: { exercise: Exercise }) {
  const [code, setCode] = useState(exercise.starterCode);
  const [status, setStatus] = useState<RunStatus>("ready");
  const [output, setOutput] = useState("Ready. Edit the solution, then run the tests.");
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const statusLabel = useMemo(() => {
    if (status === "running") return "Running";
    if (status === "passed") return "Passed";
    if (status === "failed") return "Failed";
    if (status === "error") return "Error";
    return "Ready";
  }, [status]);

  async function runTests() {
    if (status === "running") return;

    setStatus("running");
    setDurationMs(null);
    setOutput("$ python -m pytest -q\n\nStarting an isolated sandbox…");

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.status === 401) {
        window.location.replace("/login?reason=expired");
        return;
      }

      const payload: unknown = await response.json();

      if (!isRunResponse(payload)) {
        throw new Error("The execution service returned an unexpected response.");
      }

      setDurationMs(payload.durationMs);

      if (payload.status === "error") {
        setStatus("error");
        setOutput(
          `$ python -m pytest -q\n\n${payload.output}${payload.output ? "\n\n" : ""}${payload.message}`,
        );
        return;
      }

      setStatus(payload.status);
      setOutput(`$ python -m pytest -q\n\n${payload.output || "No output returned."}`);
    } catch (error) {
      setStatus("error");
      setOutput(
        `$ python -m pytest -q\n\n${
          error instanceof Error ? error.message : "Unable to reach the execution service."
        }`,
      );
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
          <div className={`${styles.status} ${styles[`status_${status}`]}`} aria-live="polite">
            <span className={styles.statusDot} aria-hidden="true" />
            {statusLabel}
            {durationMs !== null ? <span className={styles.duration}>{formatDuration(durationMs)}</span> : null}
          </div>
          <button
            className={styles.runButton}
            type="button"
            onClick={runTests}
            disabled={status === "running"}
          >
            <span className={styles.playIcon} aria-hidden="true">
              ▶
            </span>
            {status === "running" ? "Running tests…" : "Run tests"}
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
              The default <code>LogisticRegression</code> settings are sufficient for this dataset.
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

        <section className={`${styles.panel} ${styles.consolePanel}`} aria-label="Test output">
          <div className={styles.panelHeader}>
            <span>Test output</span>
            <span className={styles.readOnly}>Read only</span>
          </div>
          <div className={styles.panelContent}>
            <OutputConsole content={output} />
          </div>
        </section>
      </section>
    </main>
  );
}
