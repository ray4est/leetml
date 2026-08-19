import styles from "./DigitReaderLesson.module.css";

type DigitPixelGridProps = {
  pixels: readonly number[];
  label?: string;
};

export function DigitPixelGrid({ pixels, label = "" }: DigitPixelGridProps) {
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
