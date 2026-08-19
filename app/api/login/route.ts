import {
  AuthConfigurationError,
  createSessionToken,
  getSafeReturnPath,
  isSameOrigin,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToLogin(request: Request, returnPath = "/") {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "invalid");
  if (returnPath !== "/") loginUrl.searchParams.set("next", returnPath);
  return NextResponse.redirect(loginUrl, 303);
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
  let returnPath = "/";

  try {
    const formData = await request.formData();
    password = formData.get("password");
    returnPath = getSafeReturnPath(formData.get("next"));
  } catch {
    return redirectToLogin(request);
  }

  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return redirectToLogin(request, returnPath);
  }

  try {
    if (!verifyPassword(password)) {
      return redirectToLogin(request, returnPath);
    }

    const response = NextResponse.redirect(new URL(returnPath, request.url), 303);
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
