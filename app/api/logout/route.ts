import {
  getAuthenticatedSession,
  isSameOrigin,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth";
import { terminateSessionSandbox } from "@/lib/modal";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin logout is not allowed." }, { status: 403 });
  }

  try {
    const session = await getAuthenticatedSession();
    if (session) await terminateSessionSandbox(session.id);
  } catch (error) {
    console.error("Failed to terminate the session sandbox during logout", error);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
