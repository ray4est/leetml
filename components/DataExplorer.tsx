"use client";

import { useState } from "react";
import {
  digitGallery,
  digitTrainingGallery,
  type DigitSample,
} from "@/lib/browser-digit-model";
import { DigitPixelGrid } from "./DigitPixelGrid";
import styles from "./DigitReaderLesson.module.css";

type DataSplit = "train" | "test";

function pythonArray(pixels: readonly number[]) {
  const rows = Array.from({ length: 8 }, (_, row) =>
    `    [${pixels.slice(row * 8, row * 8 + 8).join(", ")}]`,
  );
  return `np.array([\n${rows.join(",\n")}\n])`;
}

function NumberGrid({ pixels }: { pixels: readonly number[] }) {
  return (
    <div className={styles.numberGrid} role="img" aria-label="Eight by eight grid of pixel values">
      {pixels.map((value, index) => (
        <span
          key={index}
          style={{
            backgroundColor: `rgb(${Math.round((value / 16) * 255)} ${Math.round((value / 16) * 255)} ${Math.round((value / 16) * 255)})`,
            color: value >= 9 ? "#102019" : "#dce9df",
          }}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

export function DataExplorer() {
  const [split, setSplit] = useState<DataSplit>("train");
  const [sampleIndex, setSampleIndex] = useState(0);
  const samples: readonly DigitSample[] =
    split === "train" ? digitTrainingGallery : digitGallery;
  const sample = samples[sampleIndex];
  const xName = split === "train" ? "X_train" : "X_test";
  const yName = split === "train" ? "y_train" : "y_test";

  function chooseSplit(nextSplit: DataSplit) {
    setSplit(nextSplit);
    setSampleIndex(0);
  }

  return (
    <section className={styles.dataExplorer} aria-labelledby="data-explorer-title">
      <div className={styles.explorerHeader}>
        <div>
          <span>Try it · Sample data explorer</span>
          <h4 id="data-explorer-title">See one question in three forms.</h4>
          <p>
            Choose a pile and an example. Compare the picture, its 64 feature values, and the exact
            Python number table so you can see what the computer receives and why the answer matches
            it.
          </p>
        </div>
        <div className={styles.dataSplitPicker} aria-label="Choose a data pile">
          <button
            className={split === "train" ? styles.activeDataSplit : undefined}
            type="button"
            aria-pressed={split === "train"}
            onClick={() => chooseSplit("train")}
          >
            Study data
          </button>
          <button
            className={split === "test" ? styles.activeDataSplit : undefined}
            type="button"
            aria-pressed={split === "test"}
            onClick={() => chooseSplit("test")}
          >
            Test data
          </button>
        </div>
      </div>

      <div className={styles.dataSamplePicker} aria-label="Choose a digit example">
        {samples.map((candidate, index) => (
          <button
            className={index === sampleIndex ? styles.activeDataSample : undefined}
            type="button"
            key={candidate.id}
            aria-label={`Show ${split === "train" ? "study" : "test"} example ${index + 1}`}
            aria-pressed={index === sampleIndex}
            onClick={() => setSampleIndex(index)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </div>

      <div className={styles.dataViews}>
        <article className={styles.dataImageView}>
          <span>Human view · an image</span>
          <DigitPixelGrid pixels={sample.pixels} label={`Handwritten digit ${sample.label}`} />
          <p>Our eyes join the bright squares into a shape.</p>
        </article>

        <article className={styles.dataNumberView}>
          <span>Feature view · 64 grayscale numbers</span>
          <NumberGrid pixels={sample.pixels} />
          <p>Each number is one feature: 0 is black, 16 is brightest.</p>
        </article>

        <article className={styles.dataCodeView}>
          <span>Python view · one row of {xName}</span>
          <pre><code>{pythonArray(sample.pixels)}</code></pre>
          <p>
            <code>np.array(...)</code> is the Python instruction that stores the same 64 features as
            an 8 × 8 number table.
          </p>
        </article>
      </div>

      <div className={styles.groundTruthAnswer}>
        <div>
          <span>Ground truth · the trusted correct answer</span>
          <strong><code>{yName}</code> says this image is a {sample.label}</strong>
        </div>
        <b>{sample.label}</b>
        <p>
          {split === "train"
            ? "The learner may study this answer during training."
            : "The teacher keeps this answer hidden until the model has predicted, then uses it to score the model."}
        </p>
      </div>
    </section>
  );
}
