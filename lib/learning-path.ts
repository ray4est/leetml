export const DIGIT_READER_PATH = "/tasks/handwritten-digit-reader";

export type LearningQuest = {
  number: number;
  region: string;
  title: string;
  topic: string;
  description: string;
  status: "ready" | "building";
  reward: string;
  href?: typeof DIGIT_READER_PATH;
};

export const learningPath = [
  {
    number: 1,
    region: "Pixel Pass",
    title: "Handwritten Digit Reader",
    topic: "Image classification",
    description:
      "Teach a parcel sorter to recognize the numbers 0–9 from tiny grayscale images.",
    status: "ready",
    reward: "100 XP",
    href: DIGIT_READER_PATH,
  },
  {
    number: 2,
    region: "Signal Woods",
    title: "Spam Shield",
    topic: "Text classification",
    description: "Build a guardian that separates useful messages from unwanted noise.",
    status: "building",
    reward: "Mystery badge",
  },
  {
    number: 3,
    region: "Forecast Falls",
    title: "Bike Demand Forecaster",
    topic: "Regression",
    description: "Predict how many shared bikes a city will need from weather and time data.",
    status: "building",
    reward: "Mystery badge",
  },
  {
    number: 4,
    region: "Neural Ridge",
    title: "Fashion Sorter",
    topic: "Neural networks",
    description: "Train a small neural network to sort clothing images into the right bins.",
    status: "building",
    reward: "Mystery badge",
  },
  {
    number: 5,
    region: "Storyforge Summit",
    title: "Tiny Story Generator",
    topic: "nanoGPT-style language model",
    description: "Reach the summit by training a tiny model to continue stories one token at a time.",
    status: "building",
    reward: "Summit crest",
  },
] as const satisfies readonly LearningQuest[];
