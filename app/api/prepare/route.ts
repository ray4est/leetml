import { AuthConfigurationError, getAuthenticatedSession } from "@/lib/auth";
import { prepareSessionSandbox } from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getAuthenticatedSession();

    if (!session) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }

    const result = await prepareSessionSandbox(session.id);
    return Response.json(
      { status: "ready" as const, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(error.message);
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    console.error("Modal sandbox preparation failed", error);
    const errorMessage = error instanceof Error ? error.message : "";
    const message = errorMessage.startsWith("Modal credentials")
      ? errorMessage
      : "The interactive execution environment could not be prepared. Try reconnecting.";

    return Response.json({ error: message }, { status: 502 });
  }
}
