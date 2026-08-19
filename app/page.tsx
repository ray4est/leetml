import { DigitReaderLesson } from "@/components/DigitReaderLesson";
import { AuthConfigurationError, hasValidSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  let authenticated = false;

  try {
    authenticated = await hasValidSession();
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
  }

  if (!authenticated) redirect("/login");

  return <DigitReaderLesson authenticated authConfigured />;
}
