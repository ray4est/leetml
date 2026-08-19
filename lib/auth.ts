import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DIGIT_READER_PATH } from "./learning-path";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "leetml_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_VERSION = "v1";
const MIN_PASSWORD_LENGTH = 20;
const MIN_SECRET_BYTES = 32;
const SAFE_RETURN_PATHS = new Set<string>([DIGIT_READER_PATH]);

type AuthConfig = {
  password: string;
  sessionSecret: string;
};

export type AuthenticatedSession = {
  id: string;
};

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function getAuthConfig(): AuthConfig {
  const password = process.env.APP_ACCESS_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthConfigurationError(
      `APP_ACCESS_PASSWORD must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  if (!sessionSecret || Buffer.byteLength(sessionSecret, "utf8") < MIN_SECRET_BYTES) {
    throw new AuthConfigurationError(
      `SESSION_SECRET must contain at least ${MIN_SECRET_BYTES} bytes.`,
    );
  }

  return { password, sessionSecret };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function assertAuthConfigured() {
  getAuthConfig();
}

export function verifyPassword(candidate: string) {
  const { password } = getAuthConfig();
  return timingSafeEqual(digest(candidate), digest(password));
}

export function createSessionToken(now = Date.now()) {
  const { sessionSecret } = getAuthConfig();
  const expiresAt = Math.floor(now / 1_000) + SESSION_MAX_AGE_SECONDS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${SESSION_VERSION}.${expiresAt}.${nonce}`;

  return `${payload}.${sign(payload, sessionSecret)}`;
}

export function verifySessionToken(token: string, now = Date.now()) {
  const { sessionSecret } = getAuthConfig();
  const parts = token.split(".");

  if (parts.length !== 4) return false;

  const [version, expiresAtText, nonce, signature] = parts;
  const expiresAt = Number(expiresAtText);
  const nowInSeconds = Math.floor(now / 1_000);

  if (
    version !== SESSION_VERSION ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= nowInSeconds ||
    expiresAt > nowInSeconds + SESSION_MAX_AGE_SECONDS ||
    !/^[A-Za-z0-9_-]{22}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return false;
  }

  const payload = `${version}.${expiresAtText}.${nonce}`;
  return signaturesMatch(signature, sign(payload, sessionSecret));
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  assertAuthConfigured();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !verifySessionToken(token)) return null;

  return {
    id: digest(token).toString("hex").slice(0, 24),
  };
}

export async function hasValidSession() {
  return Boolean(await getAuthenticatedSession());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}

export function isSameOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function getSafeReturnPath(value: unknown) {
  return typeof value === "string" && SAFE_RETURN_PATHS.has(value) ? value : "/";
}
