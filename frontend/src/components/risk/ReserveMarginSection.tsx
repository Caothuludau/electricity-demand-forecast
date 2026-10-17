import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { ChartSkeleton } from "@/components/ui/states";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCapacityScenarios } from "@/hooks/useApi";

const MARGINS = [0.10, 0.15, 0.20];

export function ReserveMarginSection() {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError, error } = useCapacityScenarios();
  const [selected, setSelected] = useState<number>(0.15);

  if (isLoading) return <ChartSkeleton height={300} />;
  if (isError) return <p className="py-8 text-sm text-risk-high">{t("state.scenarioFail")}{error.message}</p>;
  if (!data) return null;

  const active = data.scenarios.find((s) => Math.abs(s.reserve_margin - selected) < 1e-9);
  const chartData = data.scenarios.map((s) => ({
    name: `+${(s.reserve_margin * 100).toFixed(0)}%`,
    required: s.required_capacity_mw,
    current: data.current_capacity_mw,
    isCurrent: Math.abs(s.reserve_margin - selected) < 1e-9,
  }));

  const additional = active?.additional_capacity_required_mw ?? 0;
  const needsMore = additional > 0.05;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div>
        <div className="mb-4">
          <span className="text-[11px] font-medium tracking-wide text-text-secondary uppercase">
            {t("reserve.selector")}
          </span>
          <div className="mt-2 flex gap-1 rounded border border-border bg-surface-2/60 p-0.5">
            {MARGINS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelected(m)}
                className={cn(
                  "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  Math.abs(selected - m) < 1e-9
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {(m * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>

        {active && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface-2/50 p-4">
              <div className="text-[11px] tracking-wide text-text-secondary uppercase">
                {t("reserve.equation")}
              </div>
              <div className="tnum mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t("reserve.forecastPeak")}</span>
                  <span>{active.forecast_peak_mw.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">
                    {t("reserve.reserve", { p: (active.reserve_margin * 100).toFixed(0) })}
                  </span>
                  <span>{(active.forecast_peak_mw * active.reserve_margin).toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                  <span>{t("reserve.requiredCapacity")}</span>
                  <span className="text-accent">{active.required_capacity_mw.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-text-secondary">{t("reserve.currentCapacity")}</span>
                  <span className="tnum text-capacity">{active.current_capacity_mw.toFixed(1)} MW</span>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "rounded-md border px-3.5 py-2.5 text-xs leading-snug",
                needsMore
                  ? "border-risk-high/40 bg-risk-high/5 text-risk-high"
                  : "border-risk-low/30 bg-risk-low/5 text-risk-low",
              )}
            >
              {needsMore ? (
                <>{t("reserve.needsMore", { mw: additional.toFixed(1) })}</>
              ) : (
                <>{t("reserve.sufficient")}</>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-[280px]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis
              tickFormatter={(v: number) => v.toFixed(0)}
              {...axisProps}
              width={52}
              domain={[0, "dataMax"]}
            />
            <Tooltip
              cursor={{ fill: colors.cursor }}
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} MW`,
                name === "current" ? t("reserve.tooltipCurrent") : t("reserve.tooltipRequired"),
              ]}
            />
            {/* reference bar showing the current capacity level behind each scenario */}
            <Bar dataKey="current" fill="transparent" stroke={colors.axis} strokeDasharray="4 3" radius={[3, 3, 0, 0]} maxBarSize={72} isAnimationActive={false} />
            <Bar dataKey="required" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {chartData.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.isCurrent ? colors.forecast : "rgba(56,189,248,0.30)"}
                  stroke={d.isCurrent ? colors.forecast : colors.bandBorder}
                />
              ))}
              <LabelList
                dataKey="required"
                position="top"
                formatter={(v: unknown) => Number(v).toFixed(1)}
                style={{ fill: "#8b98a9", fontSize: 11, fontFamily: "var(--font-mono)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-center text-[11px] text-text-muted">
          {t("reserve.caption", {
            c: `${data.current_capacity_mw.toFixed(1)} MW`,
          })}
        </p>
      </div>
    </div>
  );
}
