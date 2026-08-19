import { ModalClient } from "modal";

const APP_NAME = "leetml-v0";
const IMAGE_NAME = "leetml-v0-runtime:latest";

const EXPORT_SOURCE = String.raw`
import json

import numpy as np
from sklearn.datasets import load_digits
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


digits = load_digits()
X_train, X_test, y_train, y_test = train_test_split(
    digits.data,
    digits.target,
    test_size=0.25,
    random_state=42,
    stratify=digits.target,
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
model = LogisticRegression(max_iter=5000, random_state=42)
model.fit(X_train_scaled, y_train)
predictions = model.predict(scaler.transform(X_test))

selected = []
for digit in range(10):
    matching = np.flatnonzero(y_test == digit)
    selected.extend(int(index) for index in matching[:2])

if all(predictions[index] == y_test[index] for index in selected):
    mistake = int(np.flatnonzero(predictions != y_test)[0])
    mistake_label = int(y_test[mistake])
    replace_at = next(
        position
        for position, index in enumerate(selected)
        if int(y_test[index]) == mistake_label
    )
    selected[replace_at] = mistake

payload = {
    "accuracy": float(np.mean(predictions == y_test)),
    "mean": scaler.mean_.tolist(),
    "scale": scaler.scale_.tolist(),
    "coefficients": model.coef_.tolist(),
    "intercepts": model.intercept_.tolist(),
    "gallery": [
        {
            "id": f"sample-{position + 1}",
            "label": int(y_test[index]),
            "pixels": X_test[index].astype(int).tolist(),
        }
        for position, index in enumerate(selected)
    ],
}

print(json.dumps(payload, separators=(",", ":")))
`;

if (!process.env.MODAL_TOKEN_ID || !process.env.MODAL_TOKEN_SECRET) {
  throw new Error("MODAL_TOKEN_ID and MODAL_TOKEN_SECRET are required.");
}

const modal = new ModalClient();
let sandbox;

try {
  const app = await modal.apps.fromName(APP_NAME, { createIfMissing: true });
  const image = await modal.images.fromName(IMAGE_NAME);
  sandbox = await modal.sandboxes.create(app, image, {
    command: ["sleep", "300"],
    cpu: 1,
    memoryMiB: 1024,
    outboundCidrAllowlist: [],
    outboundDomainAllowlist: [],
    timeoutMs: 5 * 60 * 1_000,
  });
  const process = await sandbox.exec(["python", "-c", EXPORT_SOURCE], {
    mode: "text",
    timeoutMs: 60_000,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    process.stdout.readText(),
    process.stderr.readText(),
    process.wait(),
  ]);

  if (exitCode !== 0) {
    throw new Error(`Browser model export failed (${exitCode}): ${stderr}`);
  }

  console.log(stdout.trim());
} finally {
  await sandbox?.terminate().catch(() => undefined);
  modal.close();
}
