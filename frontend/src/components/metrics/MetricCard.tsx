import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/primitives";
import { useI18n, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types/api";

const riskStyles: Record<RiskLevel, { text: string; dot: string }> = {
  low: { text: "text-risk-low", dot: "bg-risk-low" },
  medium: { text: "text-risk-medium", dot: "bg-risk-medium" },
  high: { text: "text-risk-high", dot: "bg-risk-high" },
  unknown: { text: "text-text-muted", dot: "bg-text-muted" },
};

const riskLabelKeys: Record<RiskLevel, I18nKey> = {
  low: "risk.LOW",
  medium: "risk.MEDIUM",
  high: "risk.HIGH",
  unknown: "risk.UNKNOWN",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const { t } = useI18n();
  const s = riskStyles[level] ?? riskStyles.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-border-strong px-1.5 py-0.5 text-[10px] font-semibold tracking-wider",
        s.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {t(riskLabelKeys[level] ?? "risk.UNKNOWN")}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  context,
  status,
  loading,
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  context?: ReactNode;
  status?: RiskLevel;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-text-secondary uppercase">
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="tnum text-2xl font-semibold text-text-primary">{value}</span>
          {unit && <span className="text-xs text-text-secondary">{unit}</span>}
          {status && <RiskBadge level={status} className="ml-auto" />}
        </div>
      )}
      {context && (
        <div className="mt-1 text-xs text-text-muted">
          {loading ? <Skeleton className="h-3.5 w-32" /> : context}
        </div>
      )}
    </div>
  );
}
