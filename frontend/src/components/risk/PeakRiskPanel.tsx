import { AlertTriangle } from "lucide-react";

import { ChartSkeleton } from "@/components/ui/states";
import { RiskBadge } from "@/components/metrics/MetricCard";
import { usePeakWindows } from "@/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { formatHour, formatMW } from "@/lib/utils";
import type { PeakWindow } from "@/types/api";

function RiskWindowCard({ window: w }: { window: PeakWindow }) {
  const { t } = useI18n();
  const isCentralBreach = w.breach;
  const isUncertaintyRisk = !w.breach && w.risk_level === "medium";

  return (
    <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="tnum text-sm font-semibold text-text-primary">{formatHour(w.timestamp)}</span>
        <RiskBadge level={w.risk_level} />
      </div>
      <dl className="mt-2.5 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-text-secondary">{t("risk.cardForecast")}</dt>
          <dd className="tnum text-text-primary">{formatMW(w.forecast_mw)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-secondary">P90</dt>
          <dd className="tnum text-text-primary">{w.p90_mw !== null ? formatMW(w.p90_mw) : "—"}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1">
          <dt className="text-text-secondary">{t("risk.cardCapacity")}</dt>
          <dd className="tnum text-capacity">{formatMW(w.capacity_mw)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-text-muted">
        {isCentralBreach
          ? w.p90_mw === null
            ? t("risk.observedBreach")
            : t("risk.centralBreach")
          : isUncertaintyRisk
            ? t("risk.uncertaintyBreach")
            : t("risk.withinThreshold")}
      </p>
    </div>
  );
}

export function PeakRiskPanel() {
  const { t } = useI18n();
  const { data, isLoading, isError, error } = usePeakWindows(12);

  if (isLoading) return <ChartSkeleton height={180} />;
  if (isError) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-risk-high">
        <AlertTriangle className="h-4 w-4" /> {t("state.riskLoadFail")}{error.message}
      </p>
    );
  }
  if (!data || data.windows.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-text-primary">{t("state.noRiskWindows")}</p>
        <p className="mt-1 text-xs text-text-secondary">{t("state.noRiskDesc")}</p>
      </div>
    );
  }

  const high = data.windows.filter((w) => w.risk_level === "high").length;
  const medium = data.windows.filter((w) => w.risk_level === "medium").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-text-secondary">
        <span>{t("risk.severeHours", { n: data.windows.length })}</span>
        {high > 0 && (
          <span>
            <span className="tnum text-risk-high">{high}</span> {t("risk.breach")}
          </span>
        )}
        {medium > 0 && (
          <span>
            <span className="tnum text-risk-medium">{medium}</span> {t("risk.uncertaintyDriven")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.windows.map((w) => (
          <RiskWindowCard key={w.timestamp} window={w} />
        ))}
      </div>
    </div>
  );
}
