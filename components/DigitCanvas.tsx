"use client";

import { useEffect, useRef } from "react";
import styles from "./DigitReaderLesson.module.css";

type DigitCanvasProps = {
  onPixelsChange: (pixels: number[] | null) => void;
};

const GRID_SIZE = 8;
const PIXEL_COUNT = GRID_SIZE * GRID_SIZE;

function cellFromPointer(canvas: HTMLCanvasElement, event: React.PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  const column = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * GRID_SIZE)),
  );
  const row = Math.min(
    GRID_SIZE - 1,
    Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * GRID_SIZE)),
  );
  return { column, row };
}

function renderPixels(canvas: HTMLCanvasElement, pixels: readonly number[]) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const image = context.createImageData(GRID_SIZE, GRID_SIZE);
  pixels.forEach((value, index) => {
    const brightness = Math.round((value / 16) * 255);
    const offset = index * 4;
    image.data[offset] = brightness;
    image.data[offset + 1] = brightness;
    image.data[offset + 2] = brightness;
    image.data[offset + 3] = 255;
  });
  context.putImageData(image, 0, 0);
}

function paintLine(
  pixels: number[],
  from: { column: number; row: number },
  to: { column: number; row: number },
) {
  let column = from.column;
  let row = from.row;
  const columnStep = column < to.column ? 1 : -1;
  const rowStep = row < to.row ? 1 : -1;
  const columnDistance = Math.abs(to.column - column);
  const rowDistance = -Math.abs(to.row - row);
  let error = columnDistance + rowDistance;

  while (true) {
    pixels[row * GRID_SIZE + column] = 16;
    if (column === to.column && row === to.row) return;
    const doubledError = error * 2;
    if (doubledError >= rowDistance) {
      error += rowDistance;
      column += columnStep;
    }
    if (doubledError <= columnDistance) {
      error += columnDistance;
      row += rowStep;
    }
  }
}

export function DigitCanvas({ onPixelsChange }: DigitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastCellRef = useRef<{ column: number; row: number } | null>(null);
  const pixelsRef = useRef<number[]>(Array(PIXEL_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderPixels(canvas, pixelsRef.current);
  }, []);

  function paint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cell = cellFromPointer(canvas, event);
    paintLine(pixelsRef.current, lastCellRef.current ?? cell, cell);
    lastCellRef.current = cell;
    renderPixels(canvas, pixelsRef.current);
    onPixelsChange([...pixelsRef.current]);
  }

  function beginDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || event.button !== 0) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastCellRef.current = null;
    paint(event);
  }

  function continueDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    paint(event);
  }

  function finishDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastCellRef.current = null;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function clearCanvas() {
    pixelsRef.current.fill(0);
    const canvas = canvasRef.current;
    if (canvas) renderPixels(canvas, pixelsRef.current);
    onPixelsChange(null);
  }

  return (
    <div className={styles.canvasShell}>
      <div className={styles.pixelCanvasFrame}>
        <canvas
          ref={canvasRef}
          className={styles.drawCanvas}
          width={GRID_SIZE}
          height={GRID_SIZE}
          aria-label="Eight by eight drawing area. Click or drag across cells to draw one digit."
          onPointerDown={beginDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>
      <div className={styles.canvasToolbar}>
        <span>Paint the 64 model pixels directly</span>
        <button type="button" onClick={clearCanvas}>
          Clear pixels
        </button>
      </div>
    </div>
  );
}
