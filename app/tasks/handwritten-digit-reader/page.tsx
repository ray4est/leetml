import { CodingWorkspace } from "@/components/CodingWorkspace";
import { AuthConfigurationError, hasValidSession } from "@/lib/auth";
import { handwrittenDigitExercise } from "@/lib/exercise";
import { DIGIT_READER_PATH } from "@/lib/learning-path";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const loginPath = `/login?next=${encodeURIComponent(DIGIT_READER_PATH)}`;

export default async function HandwrittenDigitReaderPage() {
  let authenticated = false;

  try {
    authenticated = await hasValidSession();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      redirect(`${loginPath}&error=config`);
    }

    throw error;
  }

  if (!authenticated) redirect(loginPath);

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
