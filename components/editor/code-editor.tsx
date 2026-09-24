"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  height?: string;
  readOnly?: boolean;
  fontSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
}

/**
 * A real editor abstraction (Monaco) — syntax highlighting, line numbers,
 * multi-language support. See Prompt 1's CODE EDITOR note: "Do not create
 * a fake textarea and call it a code editor." Execution (Run/Submit) is
 * wired up via services/execution/* — this component only owns editing.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  height = "420px",
  readOnly = false,
  fontSize = 13,
  wordWrap = false,
  minimap = false,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();

  const handleMount: OnMount = (editor) => {
    editor.updateOptions({ tabSize: 4, insertSpaces: true });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
        onMount={handleMount}
        loading={<Skeleton className="h-full w-full" />}
        options={{
          fontSize,
          fontFamily: "var(--font-geist-mono)",
          minimap: { enabled: minimap },
          wordWrap: wordWrap ? "on" : "off",
          scrollBeyondLastLine: false,
          readOnly,
          padding: { top: 12, bottom: 12 },
          automaticLayout: true,
        }}
      />
    </div>
  );
}
