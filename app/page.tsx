import { DigitReaderLesson } from "@/components/DigitReaderLesson";
import { AuthConfigurationError, hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  let authenticated = false;
  let authConfigured = true;

  try {
    authenticated = await hasValidSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      authConfigured = false;
    } else {
      throw error;
    }
  }

  return (
    <DigitReaderLesson
      authenticated={authenticated}
      authConfigured={authConfigured}
    />
  );
}
