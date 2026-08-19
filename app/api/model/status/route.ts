import { AuthConfigurationError, getAuthenticatedSession } from "@/lib/auth";
import { getSessionModelStatus } from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return Response.json({ error: "Authentication is required." }, { status: 401 });
    }

    const status = await getSessionModelStatus(session.id);
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    console.error("Reading sandbox model status failed", error);
    return Response.json(
      { error: "The execution environment could not check your model." },
      { status: 502 },
    );
  }
}
