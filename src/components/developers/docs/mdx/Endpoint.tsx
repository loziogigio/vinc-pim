import { clsx } from "clsx";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const METHOD_STYLES: Record<Method, string> = {
  GET: "bg-[#28c76f1a] text-[#28c76f]",
  POST: "bg-[#ff9f431a] text-[#ff9f43]",
  PATCH: "bg-[#00cfe81a] text-[#00cfe8]",
  PUT: "bg-[#00cfe81a] text-[#00cfe8]",
  DELETE: "bg-[#ea54551a] text-[#ea5455]",
};

interface EndpointProps {
  method: Method;
  path: string;
  auth?: "session" | "api-key" | "bearer" | "public";
  children?: React.ReactNode;
}

export function Endpoint({ method, path, auth = "session", children }: EndpointProps) {
  return (
    <div className="not-prose my-4 flex flex-wrap items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-[#f8f8f8] px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <span
        className={clsx(
          "inline-block rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide",
          METHOD_STYLES[method],
        )}
      >
        {method}
      </span>
      <code className="flex-1 min-w-0 break-all font-mono text-[13px] font-medium text-[#5e5873] dark:text-slate-200">
        {path}
      </code>
      {auth !== "public" && (
        <span className="rounded border border-[#ebe9f1] bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#6e6b7b] dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
          auth: {auth}
        </span>
      )}
      {children && (
        <span className="w-full text-xs leading-relaxed text-[#6e6b7b] dark:text-slate-400">
          {children}
        </span>
      )}
    </div>
  );
}
