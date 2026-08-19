import {
  AuthConfigurationError,
  getAuthenticatedSession,
  isSameOrigin,
} from "@/lib/auth";
import { terminateSessionSandbox } from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let session;

  try {
    session = await getAuthenticatedSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }
    throw error;
  }

  if (!session) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin resets are not allowed." }, { status: 403 });
  }

  try {
    await terminateSessionSandbox(session.id);
    return Response.json(
      { status: "reset" as const },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Resetting the session workspace failed", error);
    return Response.json(
      { error: "The private workspace could not be reset." },
      { status: 502 },
    );
  }
}
