import { useMemo, useState } from "react";

import { ForecastChart } from "@/components/forecast/ForecastChart";
import { KpiRow } from "@/components/forecast/KpiRow";
import { TimeRangeSelector, type RangePreset } from "@/components/layout/TimeRangeSelector";
import {
  HourlyProfileChart,
  MonthlyDistributionChart,
  WeekdayWeekendChart,
  ZoneContributionChart,
} from "@/components/charts/LoadPatterns";
import { PeakRiskPanel } from "@/components/risk/PeakRiskPanel";
import { ReserveMarginSection } from "@/components/risk/ReserveMarginSection";
import { ModelPerformanceSection } from "@/components/metrics/ModelPerformance";
import { Panel } from "@/components/ui/primitives";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { useForecast, useOverview } from "@/hooks/useApi";
import { useI18n } from "@/lib/i18n";

function isoDaysAgo(dataEnd: string | undefined, days: number): string | undefined {
  if (!dataEnd) return undefined;
  const d = new Date(dataEnd);
  d.setHours(d.getHours() - days);
  return d.toISOString();
}

export function DashboardPage() {
  const { t } = useI18n();
  const [range, setRange] = useState<RangePreset>(168);
  const { data: overview, isError: overviewError, error: overviewErr, refetch } = useOverview();

  const start = useMemo(
    () => (range === "custom" ? undefined : isoDaysAgo(overview?.data_end, range as number)),
    [range, overview?.data_end],
  );

  const {
    data: forecast,
    isLoading: forecastLoading,
    isError: forecastError,
    error: forecastErr,
    refetch: refetchForecast,
  } = useForecast(start, overview?.data_end);

  return (
    <div className="space-y-6">
      {/* SECTION A — Executive forecast status */}
      <KpiRow />

      {/* SECTION B — Main visualization */}
      <Panel
        title={t("fc.title")}
        subtitle={t("fc.subtitle")}
        actions={<TimeRangeSelector value={range} onChange={setRange} />}
      >
        {forecastError ? (
          <ErrorState message={forecastErr.message} onRetry={() => refetchForecast()} />
        ) : overviewError ? (
          <ErrorState message={overviewErr.message} onRetry={() => refetch()} />
        ) : forecastLoading ? (
          <ChartSkeleton height={380} />
        ) : !forecast || forecast.points.length === 0 ? (
          <EmptyState title={t("state.emptyTitle")} description={t("state.emptyDesc")} />
        ) : (
          <ForecastChart points={forecast.points} />
        )}
      </Panel>

      {/* SECTION C — Peak risk */}
      <Panel title={t("risk.title")} subtitle={t("risk.subtitle")}>
        <PeakRiskPanel />
      </Panel>

      {/* SECTION D — Reserve margin scenarios */}
      <Panel title={t("reserve.title")} subtitle={t("reserve.subtitle")}>
        <ReserveMarginSection />
      </Panel>

      {/* SECTION E — Model performance */}
      <Panel title={t("perf.title")} subtitle={t("perf.subtitle")}>
        <ModelPerformanceSection />
      </Panel>

      {/* SECTION F — Load patterns */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title={t("pat.hourlyTitle")} subtitle={t("pat.hourlySub")}>
          <HourlyProfileChart />
        </Panel>
        <Panel title={t("pat.weekdayTitle")} subtitle={t("pat.weekdaySub")}>
          <WeekdayWeekendChart />
        </Panel>
        <Panel title={t("pat.zoneTitle")} subtitle={t("pat.zoneSub")}>
          <ZoneContributionChart />
        </Panel>
        <Panel title={t("pat.monthlyTitle")} subtitle={t("pat.monthlySub")}>
          <MonthlyDistributionChart />
        </Panel>
      </div>
    </div>
  );
}
