import {
  AuthConfigurationError,
  createSessionToken,
  isSameOrigin,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToLogin(request: Request) {
  return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Cross-origin login is not allowed." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_048) {
    return redirectToLogin(request);
  }

  let password: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    password = formData.get("password");
  } catch {
    return redirectToLogin(request);
  }

  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return redirectToLogin(request);
  }

  try {
    if (!verifyPassword(password)) {
      return redirectToLogin(request);
    }

    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(), sessionCookieOptions());
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error(error.message);
      return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    throw error;
  }
}
