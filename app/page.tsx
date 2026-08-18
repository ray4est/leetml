import { CodingWorkspace } from "@/components/CodingWorkspace";
import { AuthConfigurationError, hasValidSession } from "@/lib/auth";
import { logisticRegressionExercise } from "@/lib/exercise";
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

  const { title, eyebrow, description, functionSignature, requirements, starterCode } =
    logisticRegressionExercise;

  return (
    <CodingWorkspace
      exercise={{
        title,
        eyebrow,
        description,
        functionSignature,
        requirements,
        starterCode,
      }}
    />
  );
}
