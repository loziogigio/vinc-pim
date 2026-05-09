"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CodeBlockProps {
  title?: string;
  code: string;
  language?: string;
}

export function CodeBlock({ title, code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="not-prose my-5 overflow-hidden rounded-[0.428rem] border border-[#ebe9f1] bg-[#f8f8f8] dark:border-white/10 dark:bg-[#0f1419]">
      <div className="flex items-center justify-between border-b border-[#ebe9f1] bg-[#f0f0f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5e5873] dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <span>{title ?? language ?? "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#6e6b7b] transition hover:bg-white hover:text-[#009688] dark:text-slate-400 dark:hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-[#5e5873] dark:text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
