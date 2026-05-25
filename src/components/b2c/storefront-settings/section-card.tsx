"use client";

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6 px-6 py-6">{children}</div>
    </div>
  );
}
