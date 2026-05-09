import { clsx } from "clsx";

type BadgeTone = "neutral" | "primary" | "warning" | "danger" | "success";

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: "bg-[#ebe9f1] text-[#6e6b7b] dark:bg-white/10 dark:text-slate-300",
  primary: "bg-[#00968814] text-[#009688]",
  warning: "bg-[#ff9f431a] text-[#ff9f43]",
  danger: "bg-[#ea54551a] text-[#ea5455]",
  success: "bg-[#28c76f1a] text-[#28c76f]",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}
