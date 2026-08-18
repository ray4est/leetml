import { CodingWorkspace } from "@/components/CodingWorkspace";
import { logisticRegressionExercise } from "@/lib/exercise";

export default function Home() {
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
