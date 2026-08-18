import { ModalClient, type Sandbox } from "modal";

import { logisticRegressionExercise } from "@/lib/exercise";

const APP_NAME = "leetml-v0";
const IMAGE_NAME = "leetml-v0-runtime:latest";
const WORKDIR = "/workspace";
const MAX_OUTPUT_BYTES = 100 * 1024;

export type SandboxRunResult = {
  output: string;
  exitCode: number;
  durationMs: number;
};

function assertModalCredentials() {
  if (!process.env.MODAL_TOKEN_ID || !process.env.MODAL_TOKEN_SECRET) {
    throw new Error(
      "Modal credentials are not configured. Copy .env.example to .env.local and add your token.",
    );
  }
}

function truncateOutput(output: string) {
  const encoded = Buffer.from(output, "utf8");
  if (encoded.byteLength <= MAX_OUTPUT_BYTES) return output;

  return `${encoded.subarray(0, MAX_OUTPUT_BYTES).toString("utf8")}\n\n[output truncated at 100 KiB]`;
}

function combineOutput(stdout: string, stderr: string) {
  if (!stderr) return stdout;
  if (!stdout) return stderr;
  return `${stdout.trimEnd()}\n\n--- stderr ---\n${stderr}`;
}

export async function runSubmission(code: string): Promise<SandboxRunResult> {
  assertModalCredentials();

  const startedAt = Date.now();
  const modal = new ModalClient();
  let sandbox: Sandbox | null = null;

  try {
    const [app, image] = await Promise.all([
      modal.apps.fromName(APP_NAME, { createIfMissing: true }),
      modal.images.fromName(IMAGE_NAME),
    ]);

    sandbox = await modal.sandboxes.create(app, image, {
      blockNetwork: true,
      cpu: 1,
      cpuLimit: 1,
      memoryMiB: 1024,
      memoryLimitMiB: 2048,
      timeoutMs: 30_000,
      workdir: WORKDIR,
      tags: { app: "leetml", exercise: logisticRegressionExercise.id },
    });

    await Promise.all([
      sandbox.filesystem.writeText(code, `${WORKDIR}/solution.py`),
      sandbox.filesystem.writeText(
        logisticRegressionExercise.testSource,
        `${WORKDIR}/test_solution.py`,
      ),
    ]);

    const process = await sandbox.exec(
      ["python", "-m", "pytest", "-q", "--disable-warnings", "--maxfail=1"],
      { mode: "text", timeoutMs: 30_000, workdir: WORKDIR },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      process.stdout.readText(),
      process.stderr.readText(),
      process.wait(),
    ]);

    return {
      output: truncateOutput(combineOutput(stdout, stderr)),
      exitCode,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (sandbox) {
      await sandbox.terminate().catch((error: unknown) => {
        console.error("Failed to terminate Modal sandbox", error);
      });
    }
    modal.close();
  }
}
