import { randomUUID } from "node:crypto";
import {
  AlreadyExistsError,
  ModalClient,
  NotFoundError,
  Probe,
  SandboxFilesystemNotFoundError,
  type App,
  type Image,
  type Sandbox,
} from "modal";

import { logisticRegressionExercise } from "@/lib/exercise";
import {
  TERMINAL_BRIDGE_SOURCE,
  TERMINAL_COMMAND_TIMEOUT_SECONDS,
  TERMINAL_IDLE_TIMEOUT_SECONDS,
  TERMINAL_PORT,
} from "@/lib/terminal-bridge";

const APP_NAME = "leetml-v0";
const IMAGE_NAME = "leetml-v0-runtime:latest";
const WORKDIR = "/workspace";
const SOLUTION_PATH = `${WORKDIR}/solution.py`;
const TEST_PATH = `${WORKDIR}/test_solution.py`;
const PREPARATION_TIMEOUT_MS = 30_000;
const SANDBOX_IDLE_TIMEOUT_MS = 60 * 60 * 1_000;
const SANDBOX_MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const RUNTIME_VERSION = "terminal-v6";

type ModalResources = {
  app: App;
  image: Image;
};

export type SandboxPreparationResult = {
  durationMs: number;
  terminalUrl: string;
  terminalToken: string;
};

export class SessionSandboxUnavailableError extends Error {
  constructor() {
    super("The session sandbox is no longer available.");
    this.name = "SessionSandboxUnavailableError";
  }
}

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

    if ((await sandbox.poll()) !== null) {
      sandbox.detach();
      return null;
    }

    const tags = await sandbox.getTags();
    if (tags.runtime !== RUNTIME_VERSION) {
      await sandbox.terminate();
      return null;
    }

    return sandbox;
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
      command: ["python", "-u", "-c", TERMINAL_BRIDGE_SOURCE],
      cpu: 1,
      cpuLimit: 1,
      env: {
        LEETML_COMMAND_TIMEOUT_SECONDS: String(TERMINAL_COMMAND_TIMEOUT_SECONDS),
        LEETML_IDLE_TIMEOUT_SECONDS: String(TERMINAL_IDLE_TIMEOUT_SECONDS),
        LEETML_SESSION_ID: sessionId,
        LEETML_TERMINAL_PORT: String(TERMINAL_PORT),
      },
      idleTimeoutMs: SANDBOX_IDLE_TIMEOUT_MS,
      memoryMiB: 1024,
      memoryLimitMiB: 2048,
      outboundCidrAllowlist: [],
      outboundDomainAllowlist: [],
      readinessProbe: Probe.withExec(
        [
          "python",
          "-c",
          `import socket; socket.create_connection(("127.0.0.1", ${TERMINAL_PORT}), 1).close()`,
        ],
        { intervalMs: 250 },
      ),
      timeoutMs: SANDBOX_MAX_LIFETIME_MS,
      workdir: WORKDIR,
      tags: {
        app: "leetml",
        exercise: logisticRegressionExercise.id,
        runtime: RUNTIME_VERSION,
        session: sessionId,
      },
    });

    await sandbox.waitUntilReady(PREPARATION_TIMEOUT_MS);
    return sandbox.sandboxId;
  } catch (error) {
    if (!(error instanceof AlreadyExistsError)) {
      if (sandbox) await sandbox.terminate().catch(() => undefined);
      throw error;
    }

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

async function initializeWorkspace(sandbox: Sandbox) {
  await sandbox.filesystem.writeText(logisticRegressionExercise.testSource, TEST_PATH);

  try {
    await sandbox.filesystem.stat(SOLUTION_PATH);
  } catch (error) {
    if (!(error instanceof SandboxFilesystemNotFoundError)) throw error;
    await sandbox.filesystem.writeText(logisticRegressionExercise.starterCode, SOLUTION_PATH);
  }
}

async function prepareSessionSandboxOnce(sessionId: string) {
  const startedAt = Date.now();
  const sandbox = await getOrCreateSessionSandbox(sessionId);
  let ready = false;

  try {
    await sandbox.waitUntilReady(PREPARATION_TIMEOUT_MS);
    await initializeWorkspace(sandbox);

    const process = await sandbox.exec(
      ["python", "-c", "import numpy; import sklearn"],
      { mode: "text", timeoutMs: PREPARATION_TIMEOUT_MS, workdir: WORKDIR },
    );
    const [, stderr, exitCode] = await Promise.all([
      process.stdout.readText(),
      process.stderr.readText(),
      process.wait(),
    ]);

    if (exitCode !== 0) {
      throw new Error(`Sandbox preparation failed with exit code ${exitCode}: ${stderr}`);
    }

    const credentials = await sandbox.createConnectToken({
      port: TERMINAL_PORT,
      userMetadata: JSON.stringify({ sessionId }),
    });

    ready = true;
    return {
      durationMs: Date.now() - startedAt,
      terminalUrl: credentials.url,
      terminalToken: credentials.token,
    };
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

export async function saveSessionSolution(code: string, sessionId: string) {
  const sandbox = await findSessionSandbox(sessionId);
  if (!sandbox) throw new SessionSandboxUnavailableError();

  const temporaryPath = `${WORKDIR}/.solution-${randomUUID()}.tmp`;

  try {
    await sandbox.filesystem.writeText(code, temporaryPath);
    const process = await sandbox.exec(["mv", "-f", temporaryPath, SOLUTION_PATH], {
      mode: "text",
      timeoutMs: 5_000,
      workdir: WORKDIR,
    });
    const exitCode = await process.wait();
    if (exitCode !== 0) {
      throw new Error(`Saving solution.py failed with exit code ${exitCode}.`);
    }
  } finally {
    await sandbox.filesystem.remove(temporaryPath).catch(() => undefined);
    sandbox.detach();
  }
}

export async function terminateSessionSandbox(sessionId: string) {
  const sandbox = await findSessionSandbox(sessionId);
  if (!sandbox) return false;

  await sandbox.terminate();
  return true;
}
