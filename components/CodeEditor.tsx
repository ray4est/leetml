"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const configureTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("leetml-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748B", fontStyle: "italic" },
      { token: "keyword", foreground: "C084FC" },
      { token: "string", foreground: "86EFAC" },
      { token: "number", foreground: "FBBF24" },
      { token: "type.identifier", foreground: "67E8F9" },
    ],
    colors: {
      "editor.background": "#0D131C",
      "editor.foreground": "#E5E7EB",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#94A3B8",
      "editor.selectionBackground": "#1E3A5F",
      "editor.inactiveSelectionBackground": "#172A45",
      "editorCursor.foreground": "#60A5FA",
      "editorIndentGuide.background1": "#1F2937",
      "editorIndentGuide.activeBackground1": "#334155",
    },
  });
};

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language="python"
      path="solution.py"
      theme="leetml-dark"
      value={value}
      beforeMount={configureTheme}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      loading={<span style={{ color: "#94a3b8" }}>Loading editor…</span>}
      options={{
        automaticLayout: true,
        contextmenu: false,
        cursorBlinking: "smooth",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontLigatures: false,
        fontSize: 14,
        lineHeight: 22,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: "line",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 4,
        wordWrap: "on",
      }}
    />
  );
}
