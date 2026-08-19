import browserDigitModel from "./browser-digit-model-data";

export type DigitSample = {
  id: string;
  label: number;
  pixels: readonly number[];
};

export type NearestDigit = {
  label: number;
  pixels: readonly number[];
  distance: number;
};

export type DigitPrediction = {
  digit: number;
  neighbors?: readonly NearestDigit[];
};

type NeighborCandidate = {
  index: number;
  squaredDistance: number;
};

export const digitGallery: readonly DigitSample[] = browserDigitModel.gallery;
export const browserModelAccuracy = browserDigitModel.accuracy;
export const digitTrainingGallery: readonly DigitSample[] = Array.from(
  { length: 10 },
  (_, label) =>
    browserDigitModel.trainingLabels
      .map((trainingLabel, index) => ({ trainingLabel, index }))
      .filter(({ trainingLabel }) => trainingLabel === label)
      .slice(0, 2)
      .map(({ index }, example) => ({
        id: `training-${label}-${example + 1}`,
        label,
        pixels: browserDigitModel.trainingPixels[index],
      })),
).flat();

function assertDigitPixels(pixels: readonly number[]) {
  if (
    pixels.length !== 64 ||
    pixels.some((value) => !Number.isFinite(value) || value < 0 || value > 16)
  ) {
    throw new Error("A digit must contain 64 pixel values between 0 and 16.");
  }
}

function nearestTrainingDigits(pixels: readonly number[]) {
  const candidates: NeighborCandidate[] = browserDigitModel.trainingPixels.map(
    (trainingPixels, index) => {
      let squaredDistance = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 1) {
        const difference = pixels[pixel] - trainingPixels[pixel];
        squaredDistance += difference * difference;
      }
      return { index, squaredDistance };
    },
  );

  return candidates
    .sort(
      (left, right) =>
        left.squaredDistance - right.squaredDistance || left.index - right.index,
    )
    .slice(0, 3);
}

export function predictBrowserDigit(pixels: readonly number[]): DigitPrediction {
  assertDigitPixels(pixels);
  const nearest = nearestTrainingDigits(pixels);
  const exactMatch = nearest.some((candidate) => candidate.squaredDistance === 0);
  const votes = Array<number>(10).fill(0);

  nearest.forEach((candidate) => {
    const label = browserDigitModel.trainingLabels[candidate.index];
    const weight = exactMatch
      ? candidate.squaredDistance === 0
        ? 1
        : 0
      : 1 / Math.sqrt(candidate.squaredDistance);
    votes[label] += weight;
  });

  let digit = 0;
  for (let label = 1; label < votes.length; label += 1) {
    if (votes[label] > votes[digit]) digit = label;
  }

  return {
    digit,
    neighbors: nearest.map((candidate) => ({
      label: browserDigitModel.trainingLabels[candidate.index],
      pixels: browserDigitModel.trainingPixels[candidate.index],
      distance: Math.sqrt(candidate.squaredDistance),
    })),
  };
}
