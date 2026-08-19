"use client";

import { useEffect, useRef } from "react";
import styles from "./DigitReaderLesson.module.css";

type DigitCanvasProps = {
  onPixelsChange: (pixels: number[] | null) => void;
};

function pointOnCanvas(canvas: HTMLCanvasElement, event: React.PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

function extractDigit(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const brightness = source.data[(y * canvas.width + x) * 4];
      if (brightness < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const padding = Math.max(8, Math.round(Math.max(width, height) * 0.12));
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(canvas.width - cropX, width + padding * 2);
  const cropHeight = Math.min(canvas.height - cropY, height + padding * 2);
  const scale = Math.min(6 / cropWidth, 6 / cropHeight);
  const targetWidth = cropWidth * scale;
  const targetHeight = cropHeight * scale;

  const tiny = document.createElement("canvas");
  tiny.width = 8;
  tiny.height = 8;
  const tinyContext = tiny.getContext("2d", { willReadFrequently: true });
  if (!tinyContext) return null;
  tinyContext.fillStyle = "#000";
  tinyContext.fillRect(0, 0, 8, 8);
  tinyContext.imageSmoothingEnabled = true;
  tinyContext.imageSmoothingQuality = "high";
  tinyContext.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    (8 - targetWidth) / 2,
    (8 - targetHeight) / 2,
    targetWidth,
    targetHeight,
  );

  const reduced = tinyContext.getImageData(0, 0, 8, 8).data;
  return Array.from({ length: 64 }, (_, index) =>
    Math.round((reduced[index * 4] / 255) * 16),
  );
}

export function DigitCanvas({ onPixelsChange }: DigitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function beginDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = pointOnCanvas(canvas, event);
    context.strokeStyle = "#fff";
    context.fillStyle = "#fff";
    context.lineWidth = 28;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.arc(point.x, point.y, 14, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function continueDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = pointOnCanvas(canvas, event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    onPixelsChange(extractDigit(canvas));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    onPixelsChange(null);
  }

  return (
    <div className={styles.canvasShell}>
      <canvas
        ref={canvasRef}
        className={styles.drawCanvas}
        width={280}
        height={280}
        aria-label="Drawing area. Draw one digit from zero through nine."
        onPointerDown={beginDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
      <div className={styles.canvasToolbar}>
        <span>Draw one large digit</span>
        <button type="button" onClick={clearCanvas}>
          Clear canvas
        </button>
      </div>
    </div>
  );
}
