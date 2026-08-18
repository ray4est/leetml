import { AuthConfigurationError, hasValidSession } from "@/lib/auth";
import { runSubmission } from "@/lib/modal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CODE_BYTES = 50 * 1024;

type RunRequest = {
  code?: unknown;
};

function errorResponse(message: string, status: number, durationMs = 0, output = "") {
  return Response.json(
    {
      status: "error" as const,
      output,
      message,
      durationMs,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: RunRequest;

  try {
    if (!(await hasValidSession())) {
      return errorResponse("Authentication is required.", 401);
    }
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(error.message);
      return errorResponse("Authentication is not configured.", 503);
    }

    throw error;
  }

  try {
    body = (await request.json()) as RunRequest;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return errorResponse("Code must be a non-empty string.", 400);
  }

  if (Buffer.byteLength(body.code, "utf8") > MAX_CODE_BYTES) {
    return errorResponse("Code must not exceed 50 KiB.", 400);
  }

  try {
    const result = await runSubmission(body.code);
    return Response.json({
      status: result.exitCode === 0 ? ("passed" as const) : ("failed" as const),
      ...result,
    });
  } catch (error) {
    console.error("Modal execution failed", error);

    const errorMessage = error instanceof Error ? error.message : "";
    const message = errorMessage.startsWith("Modal credentials")
      ? errorMessage
      : /deadline exceeded|timed out|timeout/i.test(errorMessage)
        ? "Execution exceeded the 30-second limit."
        : "The execution environment could not complete this run. Check the server logs and Modal runtime setup.";

    return errorResponse(message, 502, Date.now() - startedAt);
  }
}
