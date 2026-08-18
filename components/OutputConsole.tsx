"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

function toTerminalLines(content: string) {
  return content.replace(/\r?\n/g, "\r\n");
}

export function OutputConsole({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: false,
      cursorInactiveStyle: "none",
      disableStdin: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.45,
      scrollback: 2_000,
      theme: {
        background: "#0D131C",
        foreground: "#CBD5E1",
        cursor: "#60A5FA",
        black: "#0B0F14",
        brightBlack: "#64748B",
        green: "#22C55E",
        brightGreen: "#86EFAC",
        red: "#F87171",
        brightRed: "#FCA5A5",
        yellow: "#FBBF24",
        blue: "#60A5FA",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminalRef.current = terminal;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.reset();
    terminal.write(toTerminalLines(content));
  }, [content]);

  return <div ref={containerRef} aria-label="Read-only test output" style={{ height: "100%" }} />;
}
