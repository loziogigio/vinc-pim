import { clsx } from "clsx";

export interface ParamRow {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: string;
}

interface ParamTableProps {
  rows: ParamRow[];
  caption?: string;
}

export function ParamTable({ rows, caption }: ParamTableProps) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-[0.428rem] border border-[#ebe9f1] dark:border-white/10">
      {caption && (
        <div className="border-b border-[#ebe9f1] bg-[#f8f8f8] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#5e5873] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {caption}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#ebe9f1] bg-white text-left dark:border-white/10 dark:bg-transparent">
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#5e5873] dark:text-slate-300">Field</th>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#5e5873] dark:text-slate-300">Type</th>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#5e5873] dark:text-slate-300">Required</th>
            <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#5e5873] dark:text-slate-300">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name}
              className="border-b border-[#ebe9f1] last:border-0 dark:border-white/10"
            >
              <td className="px-4 py-2 align-top">
                <code className="font-mono text-[12px] font-semibold text-[#009688]">
                  {row.name}
                </code>
              </td>
              <td className="px-4 py-2 align-top">
                <code className="font-mono text-[12px] text-[#6e6b7b] dark:text-slate-400">
                  {row.type}
                </code>
              </td>
              <td className="px-4 py-2 align-top">
                <span
                  className={clsx(
                    "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    row.required
                      ? "bg-[#ea54551a] text-[#ea5455]"
                      : "bg-[#ebe9f1] text-[#6e6b7b] dark:bg-white/10 dark:text-slate-400",
                  )}
                >
                  {row.required ? "Required" : "Optional"}
                </span>
              </td>
              <td className="px-4 py-2 align-top text-[13px] leading-relaxed text-[#6e6b7b] dark:text-slate-300">
                {row.description}
                {row.default && (
                  <span className="ml-1 text-xs text-[#9e9b99]">
                    (default: <code className="font-mono">{row.default}</code>)
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
