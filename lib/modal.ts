import { randomUUID } from "node:crypto";
import {
  AlreadyExistsError,
  ModalClient,
  NotFoundError,
  type App,
  type Image,
  type Sandbox,
} from "modal";

import { logisticRegressionExercise } from "@/lib/exercise";

const APP_NAME = "leetml-v0";
const IMAGE_NAME = "leetml-v0-runtime:latest";
const WORKDIR = "/workspace";
const MAX_OUTPUT_BYTES = 100 * 1024;
const EXECUTION_TIMEOUT_MS = 30_000;
const SANDBOX_IDLE_TIMEOUT_MS = 60 * 60 * 1_000;
const SANDBOX_MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;

type ModalResources = {
  app: App;
  image: Image;
};

export type SandboxRunResult = {
  output: string;
  exitCode: number;
  durationMs: number;
};

export type SandboxPreparationResult = {
  durationMs: number;
};

let modalClient: ModalClient | null = null;
let resourcesPromise: Promise<ModalResources> | null = null;
const sandboxCreations = new Map<string, Promise<string>>();
const sandboxPreparations = new Map<string, Promise<SandboxPreparationResult>>();

function assertModalCredentials() {
  if (!process.env.MODAL_TOKEN_ID || !process.env.MODAL_TOKEN_SECRET) {
    throw new Error(
      "Modal credentials are not configured. Copy .env.example to .env.local and add your token.",
    );
  }
}

function getModalClient() {
  assertModalCredentials();
  modalClient ??= new ModalClient();
  return modalClient;
}

async function getModalResources() {
  const modal = getModalClient();

  resourcesPromise ??= Promise.all([
    modal.apps.fromName(APP_NAME, { createIfMissing: true }),
    modal.images.fromName(IMAGE_NAME),
  ])
    .then(([app, image]) => ({ app, image }))
    .catch((error: unknown) => {
      resourcesPromise = null;
      throw error;
    });

  return resourcesPromise;
}

function sandboxName(sessionId: string) {
  if (!/^[a-f0-9]{24}$/.test(sessionId)) {
    throw new Error("Invalid authenticated session identifier.");
  }

  return `leetml-${sessionId}`;
}

async function findSessionSandbox(sessionId: string) {
  const modal = getModalClient();

  try {
    const sandbox = await modal.sandboxes.fromName(APP_NAME, sandboxName(sessionId));

    if ((await sandbox.poll()) === null) return sandbox;

    sandbox.detach();
    return null;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

async function createSessionSandbox(sessionId: string) {
  const modal = getModalClient();
  const { app, image } = await getModalResources();
  const name = sandboxName(sessionId);
  let sandbox: Sandbox | null = null;

  try {
    sandbox = await modal.sandboxes.create(app, image, {
      name,
      blockNetwork: true,
      cpu: 1,
      cpuLimit: 1,
      memoryMiB: 1024,
      memoryLimitMiB: 2048,
      timeoutMs: SANDBOX_MAX_LIFETIME_MS,
      idleTimeoutMs: SANDBOX_IDLE_TIMEOUT_MS,
      workdir: WORKDIR,
      tags: {
        app: "leetml",
        exercise: logisticRegressionExercise.id,
        session: sessionId,
      },
    });

    return sandbox.sandboxId;
  } catch (error) {
    if (!(error instanceof AlreadyExistsError)) throw error;

    const existing = await modal.sandboxes.fromName(APP_NAME, name);
    const sandboxId = existing.sandboxId;
    existing.detach();
    return sandboxId;
  } finally {
    sandbox?.detach();
  }
}

async function getOrCreateSessionSandbox(sessionId: string) {
  const modal = getModalClient();
  const existing = await findSessionSandbox(sessionId);
  if (existing) return existing;

  let creation = sandboxCreations.get(sessionId);

  if (!creation) {
    creation = createSessionSandbox(sessionId).finally(() => {
      sandboxCreations.delete(sessionId);
    });
    sandboxCreations.set(sessionId, creation);
  }

  const sandboxId = await creation;
  return modal.sandboxes.fromId(sandboxId);
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

async function prepareSessionSandboxOnce(sessionId: string) {
  const startedAt = Date.now();
  const sandbox = await getOrCreateSessionSandbox(sessionId);
  let ready = false;

  try {
    const process = await sandbox.exec(
      ["python", "-c", "import numpy; import sklearn"],
      { mode: "text", timeoutMs: EXECUTION_TIMEOUT_MS, workdir: WORKDIR },
    );
    const [, stderr, exitCode] = await Promise.all([
      process.stdout.readText(),
      process.stderr.readText(),
      process.wait(),
    ]);

    if (exitCode !== 0) {
      throw new Error(`Sandbox preparation failed with exit code ${exitCode}: ${stderr}`);
    }

    ready = true;
    return { durationMs: Date.now() - startedAt };
  } finally {
    if (ready) {
      sandbox.detach();
    } else {
      await sandbox.terminate().catch((error: unknown) => {
        console.error("Failed to terminate an unhealthy Modal sandbox", error);
      });
    }
  }
}

export async function prepareSessionSandbox(
  sessionId: string,
): Promise<SandboxPreparationResult> {
  let preparation = sandboxPreparations.get(sessionId);

  if (!preparation) {
    preparation = prepareSessionSandboxOnce(sessionId).finally(() => {
      sandboxPreparations.delete(sessionId);
    });
    sandboxPreparations.set(sessionId, preparation);
  }

  return preparation;
}

export async function runSubmission(
  code: string,
  sessionId: string,
): Promise<SandboxRunResult> {
  const startedAt = Date.now();
  const sandbox = await getOrCreateSessionSandbox(sessionId);
  const runDirectory = `${WORKDIR}/runs/${randomUUID()}`;
  let healthy = false;

  try {
    await Promise.all([
      sandbox.filesystem.writeText(code, `${runDirectory}/solution.py`),
      sandbox.filesystem.writeText(
        logisticRegressionExercise.testSource,
        `${runDirectory}/test_solution.py`,
      ),
    ]);

    const process = await sandbox.exec(
      ["python", "-m", "pytest", "-q", "--disable-warnings", "--maxfail=1"],
      { mode: "text", timeoutMs: EXECUTION_TIMEOUT_MS, workdir: runDirectory },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      process.stdout.readText(),
      process.stderr.readText(),
      process.wait(),
    ]);

    healthy = true;
    return {
      output: truncateOutput(combineOutput(stdout, stderr)),
      exitCode,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (healthy) {
      await sandbox.filesystem.remove(runDirectory, { recursive: true }).catch(() => undefined);
      sandbox.detach();
    } else {
      await sandbox.terminate().catch((error: unknown) => {
        console.error("Failed to terminate an unhealthy Modal sandbox", error);
      });
    }
  }
}

export async function terminateSessionSandbox(sessionId: string) {
  const sandbox = await findSessionSandbox(sessionId);
  if (!sandbox) return false;

  await sandbox.terminate();
  return true;
}
