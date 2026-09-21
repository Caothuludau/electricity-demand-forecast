import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { ChartSkeleton } from "@/components/ui/states";
import {
  useHourlyProfile,
  useMonthlyDistribution,
  useWeekdayWeekend,
  useZones,
} from "@/hooks/useApi";
import { monthLabels, useI18n } from "@/lib/i18n";
import type { MonthlyDistributionPoint } from "@/types/api";

export function HourlyProfileChart() {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError } = useHourlyProfile();
  if (isLoading) return <ChartSkeleton height={220} />;
  if (isError || !data)
    return <p className="py-8 text-center text-sm text-text-muted">{t("state.hourlyUnavailable")}</p>;

  const peak = data.reduce((a, b) => (b.avg_load_mw > a.avg_load_mw ? b : a));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="profileBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.forecast} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors.forecast} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="hour" tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`} {...axisProps} interval={2} />
          <YAxis tickFormatter={(v: number) => v.toFixed(1)} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(h) => `${String(Number(h)).padStart(2, "0")}:00`}
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} MW`,
              name === "avg_load_mw" ? t("pat.avgLoad") : String(name),
            ]}
          />
          <Area
            type="monotone"
            dataKey="avg_load_mw"
            stroke={colors.forecast}
            strokeWidth={1.8}
            fill="url(#profileBand)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-text-muted">
        {t("pat.eveningPeak", { h: `${String(peak.hour).padStart(2, "0")}:00` })}
      </p>
    </div>
  );
}

export function WeekdayWeekendChart() {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError } = useWeekdayWeekend();
  if (isLoading) return <ChartSkeleton height={220} />;
  if (isError || !data)
    return <p className="py-8 text-center text-sm text-text-muted">{t("state.weekdayUnavailable")}</p>;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={colors.weekday} strokeWidth="2" /></svg>
          {t("pat.weekday")}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke={colors.weekend} strokeWidth="2" /></svg>
          {t("pat.weekend")}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="hour" tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`} {...axisProps} interval={2} />
          <YAxis tickFormatter={(v: number) => v.toFixed(1)} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(h) => `${String(Number(h)).padStart(2, "0")}:00`}
            formatter={(value, name) => [
              value !== null ? `${Number(value).toFixed(2)} MW` : "—",
              name === "weekday_mw" ? t("pat.weekday") : t("pat.weekend"),
            ]}
          />
          <Line type="monotone" dataKey="weekday_mw" stroke={colors.weekday} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="weekend_mw" stroke={colors.weekend} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ZoneContributionChart() {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError } = useZones();
  if (isLoading) return <ChartSkeleton height={220} />;
  if (isError || !data)
    return <p className="py-8 text-center text-sm text-text-muted">{t("state.zoneUnavailable")}</p>;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors.zone1 }} /> {t("pat.zone1")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors.zone2 }} /> {t("pat.zone2")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors.zone3 }} /> {t("pat.zone3")}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="hour" tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`} {...axisProps} interval={2} />
          <YAxis tickFormatter={(v: number) => v.toFixed(1)} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(h) => `${String(Number(h)).padStart(2, "0")}:00`}
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} MW`,
              name === "zone1_mw"
                ? t("pat.zone1")
                : name === "zone2_mw"
                  ? t("pat.zone2")
                  : name === "zone3_mw"
                    ? t("pat.zone3")
                    : String(name),
            ]}
          />
          <Area type="monotone" dataKey="zone1_mw" stackId="z" stroke={colors.zone1} fill={colors.zone1} fillOpacity={0.25} strokeWidth={1.4} isAnimationActive={false} />
          <Area type="monotone" dataKey="zone2_mw" stackId="z" stroke={colors.zone2} fill={colors.zone2} fillOpacity={0.25} strokeWidth={1.4} isAnimationActive={false} />
          <Area type="monotone" dataKey="zone3_mw" stackId="z" stroke={colors.zone3} fill={colors.zone3} fillOpacity={0.25} strokeWidth={1.4} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyDistributionChart() {
  const { t, locale } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError } = useMonthlyDistribution();
  if (isLoading) return <ChartSkeleton height={220} />;
  if (isError || !data)
    return <p className="py-8 text-center text-sm text-text-muted">{t("state.monthlyUnavailable")}</p>;

  const MONTH_LABELS = monthLabels(locale);
  const chartData = data.map((d: MonthlyDistributionPoint) => ({
    month: MONTH_LABELS[d.month - 1] ?? String(d.month),
    min: d.min_mw,
    q1: d.q1_mw,
    median: d.median_mw,
    q3: d.q3_mw,
    max: d.max_mw,
    iqr: d.q3_mw - d.q1_mw,
    whiskerLow: d.min_mw,
    whiskerHigh: d.max_mw - d.min_mw,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis tickFormatter={(v: number) => v.toFixed(2)} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                q1: "Q1",
                iqr: "IQR (Q3−Q1)",
                whiskerLow: t("pat.tooltipMin"),
                whiskerHigh: t("pat.tooltipMaxSpan"),
              };
              return [`${Number(value).toFixed(3)} MW`, labels[String(name)] ?? String(name)];
            }}
          />
          {/* whisker: min → max */}
          <Bar dataKey="whiskerLow" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="whiskerHigh" stackId="w" fill={colors.axis} fillOpacity={0.35} radius={[2, 2, 0, 0]} isAnimationActive={false} barSize={10} />
          {/* IQR box */}
          <Bar dataKey="q1" stackId="b" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="iqr" stackId="b" fill={colors.forecast} fillOpacity={0.55} radius={[2, 2, 0, 0]} isAnimationActive={false} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-text-muted">{t("pat.monthlyCaption")}</p>
    </div>
  );
}
