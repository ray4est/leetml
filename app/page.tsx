import { CodingWorkspace } from "@/components/CodingWorkspace";
import { AuthConfigurationError, hasValidSession } from "@/lib/auth";
import { handwrittenDigitExercise } from "@/lib/exercise";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  let authenticated = false;

  try {
    authenticated = await hasValidSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      redirect("/login?error=config");
    }

    throw error;
  }

  if (!authenticated) redirect("/login");

  const {
    title,
    eyebrow,
    description,
    functionSignature,
    requirements,
    tip,
    sampleImage,
    sampleLabel,
    starterCode,
  } = handwrittenDigitExercise;

  return (
    <CodingWorkspace
      exercise={{
        title,
        eyebrow,
        description,
        functionSignature,
        requirements,
        tip,
        sampleImage,
        sampleLabel,
        starterCode,
      }}
    />
  );
}
