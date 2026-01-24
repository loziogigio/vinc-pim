"use client";

import { useRef, useCallback } from "react";
import Editor, { OnMount, OnChange } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface MonacoHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  readOnly?: boolean;
  placeholder?: string;
}

export function MonacoHtmlEditor({
  value,
  onChange,
  height = "400px",
  readOnly = false,
  placeholder,
}: MonacoHtmlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange: OnChange = useCallback(
    (newValue) => {
      onChange(newValue || "");
    },
    [onChange]
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="html"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-light"
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          folding: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          fontSize: 13,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          renderWhitespace: "selection",
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          suggest: {
            showWords: true,
            showSnippets: true,
          },
          padding: { top: 8, bottom: 8 },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-slate-50">
            <span className="text-slate-500 text-sm">Loading editor...</span>
          </div>
        }
      />
    </div>
  );
}
