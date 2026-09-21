import { AlertTriangle, Inbox, ServerOff } from "lucide-react";

import { Skeleton } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-10 text-center">
      <ServerOff className="h-6 w-6 text-risk-high" />
      <p className="text-sm font-medium text-text-primary">{t("state.apiUnavailable")}</p>
      <p className="max-w-md text-xs text-text-secondary">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded border border-border-strong px-3 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          {t("state.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md px-6 py-10 text-center">
      <Inbox className="h-6 w-6 text-text-muted" />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="max-w-md text-xs text-text-secondary">{description}</p>
    </div>
  );
}

export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-3" style={{ height }}>
      <div className="flex flex-1 items-end gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function InlineWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded border border-risk-medium/30 bg-risk-medium/5 px-3 py-2 text-xs text-risk-medium">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
