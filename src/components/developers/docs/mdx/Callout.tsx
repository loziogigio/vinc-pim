import { AlertCircle, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { clsx } from "clsx";

type CalloutKind = "info" | "warning" | "danger" | "tip";

const KIND_CONFIG: Record<
  CalloutKind,
  { icon: React.ElementType; classes: string; iconClasses: string }
> = {
  info: {
    icon: Info,
    classes:
      "border-[#00cfe8]/30 bg-[#00cfe8]/5 text-[#5e5873] dark:text-slate-200",
    iconClasses: "text-[#00cfe8]",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "border-[#ff9f43]/30 bg-[#ff9f43]/5 text-[#5e5873] dark:text-slate-200",
    iconClasses: "text-[#ff9f43]",
  },
  danger: {
    icon: AlertCircle,
    classes:
      "border-[#ea5455]/30 bg-[#ea5455]/5 text-[#5e5873] dark:text-slate-200",
    iconClasses: "text-[#ea5455]",
  },
  tip: {
    icon: Lightbulb,
    classes:
      "border-[#009688]/30 bg-[#009688]/5 text-[#5e5873] dark:text-slate-200",
    iconClasses: "text-[#009688]",
  },
};

interface CalloutProps {
  kind?: CalloutKind;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ kind = "info", title, children }: CalloutProps) {
  const config = KIND_CONFIG[kind];
  const Icon = config.icon;
  return (
    <aside
      className={clsx(
        "not-prose my-5 flex gap-3 rounded-[0.428rem] border px-4 py-3",
        config.classes,
      )}
    >
      <Icon className={clsx("mt-0.5 h-4 w-4 flex-shrink-0", config.iconClasses)} />
      <div className="text-sm leading-relaxed">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className="[&_p]:my-1 [&_code]:font-mono [&_code]:text-[12px]">
          {children}
        </div>
      </div>
    </aside>
  );
}
