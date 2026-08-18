import {
  AuthConfigurationError,
  getAuthenticatedSession,
  isSameOrigin,
  type AuthenticatedSession,
} from "@/lib/auth";
import {
  saveSessionSolution,
  SessionSandboxUnavailableError,
} from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CODE_BYTES = 50 * 1024;

type SaveRequest = {
  code?: unknown;
};

export async function POST(request: Request) {
  let session: AuthenticatedSession | null;

  try {
    session = await getAuthenticatedSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(error.message);
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    throw error;
  }

  if (!session) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin source updates are not allowed." }, { status: 403 });
  }

  let body: SaveRequest;
  try {
    body = (await request.json()) as SaveRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return Response.json({ error: "Code must be a non-empty string." }, { status: 400 });
  }

  if (Buffer.byteLength(body.code, "utf8") > MAX_CODE_BYTES) {
    return Response.json({ error: "Code must not exceed 50 KiB." }, { status: 400 });
  }

  try {
    await saveSessionSolution(body.code, session.id);
    return Response.json({ status: "saved" as const });
  } catch (error) {
    if (error instanceof SessionSandboxUnavailableError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    console.error("Saving solution.py in Modal failed", error);
    const errorMessage = error instanceof Error ? error.message : "";
    const message = errorMessage.startsWith("Modal credentials")
      ? errorMessage
      : "The execution environment could not save solution.py.";
    return Response.json({ error: message }, { status: 502 });
  }
}
