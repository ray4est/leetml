import { ModalClient } from "modal";

const APP_NAME = "leetml-v0";
const IMAGE_NAME = "leetml-v0-runtime:latest";

if (!process.env.MODAL_TOKEN_ID || !process.env.MODAL_TOKEN_SECRET) {
  console.error(
    "Missing Modal credentials. Export MODAL_TOKEN_ID and MODAL_TOKEN_SECRET before running this command.",
  );
  process.exitCode = 1;
} else {
  const modal = new ModalClient();

  try {
    console.log(`Preparing ${IMAGE_NAME}…`);
    const app = await modal.apps.fromName(APP_NAME, { createIfMissing: true });
    const image = modal.images
      .fromRegistry("python:3.12-slim")
      .dockerfileCommands([
        "RUN apt-get update && apt-get install -y --no-install-recommends bash ncurses-term && rm -rf /var/lib/apt/lists/*",
        "RUN python -m pip install --no-cache-dir numpy==2.1.3 scikit-learn==1.5.2 pytest==8.3.4 websockets==15.0.1",
      ]);
    const builtImage = await image.build(app);
    await builtImage.publish(IMAGE_NAME);
    console.log(`Published ${IMAGE_NAME}.`);
  } finally {
    modal.close();
  }
}
