import {
  AuthConfigurationError,
  getAuthenticatedSession,
  isSameOrigin,
} from "@/lib/auth";
import {
  predictWithSessionModel,
  SessionModelUnavailableError,
  SessionSandboxUnavailableError,
} from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

type PredictRequest = {
  pixels?: unknown;
};

function validPixels(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 64 &&
    value.every(
      (pixel) =>
        typeof pixel === "number" && Number.isFinite(pixel) && pixel >= 0 && pixel <= 16,
    )
  );
}

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
    return Response.json({ error: "Cross-origin predictions are not allowed." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Prediction request is too large." }, { status: 413 });
  }

  let body: PredictRequest;
  try {
    body = (await request.json()) as PredictRequest;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!validPixels(body.pixels)) {
    return Response.json(
      { error: "pixels must contain exactly 64 finite values between 0 and 16." },
      { status: 400 },
    );
  }

  try {
    const digit = await predictWithSessionModel(body.pixels, session.id);
    return Response.json({ digit }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (
      error instanceof SessionModelUnavailableError ||
      error instanceof SessionSandboxUnavailableError
    ) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    console.error("Sandbox model prediction failed", error);
    return Response.json(
      { error: "The execution environment could not run your model." },
      { status: 502 },
    );
  }
}
