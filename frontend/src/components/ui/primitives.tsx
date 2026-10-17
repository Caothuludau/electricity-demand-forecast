import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-surface",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold tracking-wide text-text-primary uppercase">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("animate-pulse rounded bg-surface-2", className)} style={style} />;
}
