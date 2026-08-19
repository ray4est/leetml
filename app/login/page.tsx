import { AuthConfigurationError, getSafeReturnPath, hasValidSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import styles from "./Login.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
    reason?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnPath = getSafeReturnPath(params.next);
  let isConfigured = true;
  let authenticated = false;

  try {
    authenticated = await hasValidSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      isConfigured = false;
    } else {
      throw error;
    }
  }

  if (authenticated) redirect(returnPath);

  const invalidPassword = params.error === "invalid";
  const sessionExpired = params.reason === "expired";

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.mark} aria-hidden="true">
          HR
        </div>
        <p className={styles.eyebrow}>Private learning lab</p>
        <h1 id="login-title">Handwriting Reader Lab</h1>
        <p className={styles.description}>
          Enter the shared family passphrase to open the lesson, playground, Python editor, and
          training terminal.
        </p>

        {!isConfigured ? (
          <p className={styles.error} role="alert">
            Authentication is not configured. Add the required environment variables and restart
            the application.
          </p>
        ) : null}
        {isConfigured && invalidPassword ? (
          <p className={styles.error} role="alert">
            That passphrase was not accepted. Try again.
          </p>
        ) : null}
        {isConfigured && sessionExpired ? (
          <p className={styles.notice} role="status">
            Your session expired. Sign in again to continue.
          </p>
        ) : null}

        <form className={styles.form} action="/api/login" method="post">
          {returnPath !== "/" ? <input name="next" type="hidden" value={returnPath} /> : null}
          <label htmlFor="password">Shared passphrase</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            required
            autoFocus
            disabled={!isConfigured}
          />
          <button type="submit" disabled={!isConfigured}>
            Unlock the lab
          </button>
        </form>

        <p className={styles.help}>
          The whole lab is limited to the two people who know this passphrase. Opening it does not
          start Modal compute; only an explicit Start or Train action does.
        </p>
      </section>
    </main>
  );
}
