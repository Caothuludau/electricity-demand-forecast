import { Activity, BatteryCharging, Gauge, TrendingUp, Zap } from "lucide-react";

import { MetricCard } from "@/components/metrics/MetricCard";
import { useCapacityScenarios, useOverview } from "@/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { formatHour, formatMW } from "@/lib/utils";

export function KpiRow() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useOverview();
  const { data: scenarios } = useCapacityScenarios();

  if (isError || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricCard
            key={i}
            label=""
            value=""
            loading
            icon={null}
          />
        ))}
      </div>
    );
  }

  const risk = data.risk_level;
  const currentMargin =
    data.capacity_mw !== null && data.current_load_mw !== null
      ? ((data.capacity_mw - data.current_load_mw) / data.capacity_mw) * 100
      : null;

  const marginScenario = scenarios?.scenarios.find(
    (s) => Math.abs(s.reserve_margin - data.reserve_margin) < 1e-9,
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        label={t("kpi.currentLoad")}
        value={data.current_load_mw?.toFixed(1) ?? "—"}
        unit="MW"
        context={
          <>
            {formatHour(data.latest_timestamp)} · {currentMargin?.toFixed(0) ?? "—"}% {t("kpi.headroom")}
          </>
        }
        icon={<Activity className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <MetricCard
        label={t("kpi.nextHourForecast")}
        value={data.next_forecast_mw?.toFixed(1) ?? "—"}
        unit="MW"
        context={<>P50 · {formatHour(data.next_forecast_timestamp)}</>}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <MetricCard
        label={t("kpi.forecastRange")}
        value={
          data.p10_mw !== null && data.p90_mw !== null
            ? `${data.p10_mw.toFixed(1)} – ${data.p90_mw.toFixed(1)}`
            : "—"
        }
        unit="MW"
        context={<>{t("kpi.p10p90Interval")}</>}
        icon={<Gauge className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <MetricCard
        label={t("kpi.capacityRisk")}
        value=""
        status={risk}
        context={<>{t("kpi.vsThreshold", { c: formatMW(data.capacity_mw, 1) })}</>}
        icon={<Zap className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <MetricCard
        label={t("kpi.requiredCapacity")}
        value={marginScenario?.required_capacity_mw?.toFixed(1) ?? data.required_capacity_mw?.toFixed(1) ?? "—"}
        unit="MW"
        context={<>{t("kpi.forecastPeakReserve", { p: (data.reserve_margin * 100).toFixed(0) })}</>}
        icon={<BatteryCharging className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
    </div>
  );
}
