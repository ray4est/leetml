"use client";

import { useState } from "react";
import {
  browserModelAccuracy,
  digitGallery,
  predictBrowserDigit,
  type DigitSample,
} from "@/lib/browser-digit-model";
import { DigitCanvas } from "./DigitCanvas";
import styles from "./DigitReaderLesson.module.css";

export type PlaygroundModel = "builtin" | "custom";

export type CustomModelStatus =
  | { state: "checking" }
  | { state: "missing" }
  | { state: "ready"; accuracy: number; trainedAt: string };

type DigitPlaygroundProps = {
  authenticated: boolean;
  customModelStatus: CustomModelStatus;
  model: PlaygroundModel;
  onModelChange: (model: PlaygroundModel) => void;
  predictCustom: (pixels: readonly number[]) => Promise<number>;
};

type PredictionResult = {
  digit: number;
  actual?: number;
  source: "sample" | "drawing";
};

function PixelGrid({ pixels, label }: { pixels: readonly number[]; label: string }) {
  return (
    <div
      className={styles.pixelGrid}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {pixels.map((brightness, index) => (
        <span
          key={index}
          style={{ backgroundColor: `rgba(248, 250, 245, ${brightness / 16})` }}
        />
      ))}
    </div>
  );
}

export function DigitPlayground({
  authenticated,
  customModelStatus,
  model,
  onModelChange,
  predictCustom,
}: DigitPlaygroundProps) {
  const [mode, setMode] = useState<"samples" | "drawing">("samples");
  const [selectedSample, setSelectedSample] = useState<DigitSample>(digitGallery[0]);
  const [drawingPixels, setDrawingPixels] = useState<number[] | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePixels = mode === "samples" ? selectedSample.pixels : drawingPixels;

  function resetPrediction() {
    setResult(null);
    setError(null);
  }

  async function predict() {
    if (!activePixels) {
      setError("Draw a digit before asking the model to predict it.");
      return;
    }

    setPredicting(true);
    setError(null);
    try {
      const digit =
        model === "builtin" ? predictBrowserDigit(activePixels) : await predictCustom(activePixels);
      setResult({
        digit,
        actual: mode === "samples" ? selectedSample.label : undefined,
        source: mode === "samples" ? "sample" : "drawing",
      });
    } catch (predictionError) {
      setResult(null);
      setError(
        predictionError instanceof Error
          ? predictionError.message
          : "The model could not make a prediction.",
      );
    } finally {
      setPredicting(false);
    }
  }

  const customModelLabel =
    customModelStatus.state === "ready"
      ? `My model · ${(customModelStatus.accuracy * 100).toFixed(1)}%`
      : customModelStatus.state === "checking"
        ? "My model · checking…"
        : "My model · train to unlock";

  return (
    <section className={styles.playgroundSection} id="playground" aria-labelledby="playground-title">
      <div className={styles.sectionNumber}>02</div>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>Playground</p>
        <h2 id="playground-title">Give the model something to read.</h2>
        <p>
          Start with real quiz images, then draw your own. The model sees neither curves nor ink—only
          64 brightness numbers arranged in an 8 × 8 square.
        </p>
      </div>

      <div className={styles.playgroundCard}>
        <div className={styles.playgroundHeader}>
          <div className={styles.tabList} role="tablist" aria-label="Digit input source">
            <button
              className={mode === "samples" ? styles.activeTab : undefined}
              type="button"
              role="tab"
              aria-selected={mode === "samples"}
              onClick={() => {
                setMode("samples");
                resetPrediction();
              }}
            >
              Test images
            </button>
            <button
              className={mode === "drawing" ? styles.activeTab : undefined}
              type="button"
              role="tab"
              aria-selected={mode === "drawing"}
              onClick={() => {
                setMode("drawing");
                resetPrediction();
              }}
            >
              Draw your own
            </button>
          </div>

          <label className={styles.modelPicker}>
            <span>Model</span>
            <select
              value={model}
              onChange={(event) => {
                onModelChange(event.target.value as PlaygroundModel);
                resetPrediction();
              }}
            >
              <option value="builtin">
                LeetML model · {(browserModelAccuracy * 100).toFixed(1)}%
              </option>
              <option value="custom" disabled={customModelStatus.state !== "ready"}>
                {customModelLabel}
              </option>
            </select>
          </label>
        </div>

        {mode === "samples" ? (
          <div className={styles.samplesPanel} role="tabpanel">
            <div className={styles.sampleStage}>
              <PixelGrid
                pixels={selectedSample.pixels}
                label="Selected handwritten digit test image with its answer hidden"
              />
              <div className={styles.samplePrompt}>
                <span>Unseen quiz image</span>
                <strong>What digit is hiding in these pixels?</strong>
                <p>Choose another image below, then ask the selected model.</p>
              </div>
            </div>
            <div className={styles.sampleStrip} aria-label="Choose a test image">
              {digitGallery.map((sample, index) => (
                <button
                  className={sample.id === selectedSample.id ? styles.selectedThumbnail : undefined}
                  type="button"
                  key={sample.id}
                  aria-label={`Choose hidden test image ${index + 1}`}
                  aria-pressed={sample.id === selectedSample.id}
                  onClick={() => {
                    setSelectedSample(sample);
                    resetPrediction();
                  }}
                >
                  <PixelGrid pixels={sample.pixels} label="" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.drawingPanel} role="tabpanel">
            <DigitCanvas
              onPixelsChange={(pixels) => {
                setDrawingPixels(pixels);
                setResult(null);
                setError(null);
              }}
            />
            <div className={styles.machineView}>
              <span>What the model sees</span>
              {drawingPixels ? (
                <PixelGrid pixels={drawingPixels} label="Your drawing reduced to 8 by 8 pixels" />
              ) : (
                <div className={styles.emptyPixelGrid}>8 × 8</div>
              )}
              <p>Your drawing is cropped, centred, and squeezed into 64 numbers from 0 to 16.</p>
            </div>
          </div>
        )}

        <div className={styles.predictionBar}>
          <div className={styles.modelState}>
            <span className={model === "custom" ? styles.customDot : styles.builtinDot} />
            {model === "custom" ? "Using your sandbox model" : "Running free in this browser"}
          </div>
          <button
            className={styles.predictButton}
            type="button"
            disabled={predicting || !activePixels}
            onClick={predict}
          >
            {predicting ? "Thinking…" : "Predict digit"}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className={styles.predictionResult} aria-live="polite">
          {error ? <p className={styles.playgroundError}>{error}</p> : null}
          {result ? (
            <>
              <span className={styles.resultLabel}>The model predicts</span>
              <strong>{result.digit}</strong>
              {result.source === "sample" && result.actual !== undefined ? (
                <p className={result.digit === result.actual ? styles.correct : styles.incorrect}>
                  {result.digit === result.actual
                    ? `Correct — the hidden answer was ${result.actual}.`
                    : `Not this time — the hidden answer was ${result.actual}. Models make mistakes too.`}
                </p>
              ) : (
                <p>Does that match what you drew? If not, inspect the 8 × 8 version and try again.</p>
              )}
            </>
          ) : (
            <p className={styles.resultPlaceholder}>The prediction will appear here.</p>
          )}
        </div>

        {!authenticated && customModelStatus.state !== "ready" ? (
          <p className={styles.unlockNote}>
            Want this menu to say <strong>My model</strong>? Train one in the Python lab below.
          </p>
        ) : null}
      </div>
    </section>
  );
}
