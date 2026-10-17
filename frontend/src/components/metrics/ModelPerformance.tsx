import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { RiskBadge } from "@/components/metrics/MetricCard";
import { ChartSkeleton } from "@/components/ui/states";
import { useI18n } from "@/lib/i18n";
import { useModelMetrics } from "@/hooks/useApi";
import { formatPct } from "@/lib/utils";

export function ModelPerformanceSection() {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const { data, isLoading, isError, error } = useModelMetrics();

  if (isLoading) return <ChartSkeleton height={220} />;
  if (isError) return <p className="py-8 text-sm text-risk-high">{t("state.metricsFail")}{error.message}</p>;
  if (!data) return null;

  const main = data.models.find((m) => m.model === "LightGBM");
  const bestBaseline = data.models
    .filter((m) => m.model.startsWith("Seasonal"))
    .sort((a, b) => a.WAPE - b.WAPE)[0];
  const improves = main && bestBaseline ? main.WAPE < bestBaseline.WAPE : false;
  const improvement =
    main && bestBaseline ? ((bestBaseline.WAPE - main.WAPE) / bestBaseline.WAPE) * 100 : 0;

  const coverageModel = main?.coverage;
  const coverageOk =
    coverageModel !== null && coverageModel !== undefined
      ? Math.abs(coverageModel - data.target_coverage) <= 0.05
      : null;

  const barData = data.models.map((m) => ({
    name: m.model.replace("Seasonal Naive", "SNaive"),
    WAPE: m.WAPE * 100,
    isMain: m.model === "LightGBM",
  }));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-secondary uppercase">
              <th className="pb-2 font-medium">{t("perf.model")}</th>
              <th className="pb-2 text-right font-medium">{t("perf.mae")}</th>
              <th className="pb-2 text-right font-medium">{t("perf.rmse")}</th>
              <th className="pb-2 text-right font-medium">{t("perf.wape")}</th>
              <th className="pb-2 text-right font-medium">{t("perf.peakTiming")}</th>
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.model} className="border-b border-border/60 last:border-0">
                <td className="py-2.5">
                  <span className={m.model === "LightGBM" ? "font-medium text-text-primary" : "text-text-secondary"}>
                    {m.model}
                  </span>
                  {m.model === "LightGBM" && (
                    <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {t("perf.main")}
                    </span>
                  )}
                </td>
                <td className="tnum py-2.5 text-right">{m.MAE.toFixed(2)}</td>
                <td className="tnum py-2.5 text-right">{m.RMSE.toFixed(2)}</td>
                <td className="tnum py-2.5 text-right">{(m.WAPE * 100).toFixed(2)}%</td>
                <td className="tnum py-2.5 text-right text-text-secondary">
                  {m.peak_timing_error_hours !== null ? `${m.peak_timing_error_hours.toFixed(0)} h` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs leading-relaxed text-text-secondary">
          {improves ? (
            <>
              {t("perf.improves", {
                p: improvement.toFixed(0),
                base: bestBaseline?.model ?? "",
                w: `${new Date(data.test_window.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${new Date(data.test_window.end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
              })}
            </>
          ) : (
            <>{t("perf.notBeat")}</>
          )}
        </p>
      </div>

      <div>
        <div className="mb-2 text-[11px] tracking-wide text-text-secondary uppercase">
          {t("perf.wapeCompare")}
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
          >
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis
              type="number"
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.25)]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              {...axisProps}
            />
            <YAxis type="category" dataKey="name" width={90} {...axisProps} />
            <Tooltip
              cursor={{ fill: colors.cursor }}
              contentStyle={tooltipStyle}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, t("perf.wape")]}
            />
            <Bar dataKey="WAPE" radius={[0, 3, 3, 0]} maxBarSize={26} isAnimationActive={false}>
              <LabelList
                dataKey="WAPE"
                position="right"
                formatter={(v: unknown) => `${Number(v).toFixed(2)}%`}
                style={{ fill: "#8b98a9", fontSize: 11, fontFamily: "var(--font-mono)" }}
              />
              {barData.map((d) => (
                <Cell key={d.name} fill={d.isMain ? colors.forecast : colors.barDim} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-5 rounded-md border border-border bg-surface-2/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">{t("perf.coverage")}</span>
            {coverageOk !== null && (
              <RiskBadge level={coverageOk ? "low" : "medium"} />
            )}
          </div>
          <div className="tnum mt-1.5 flex items-baseline gap-2">
            <span className="text-xl font-semibold">
              {coverageModel !== null && coverageModel !== undefined
                ? formatPct(coverageModel)
                : "—"}
            </span>
            <span className="text-xs text-text-muted">
              {t("perf.target")} {formatPct(data.target_coverage, 0)}
            </span>
          </div>
          {coverageOk === false && (
            <p className="mt-1.5 text-[11px] leading-snug text-risk-medium">
              {t("perf.coverageShort")}
            </p>
          )}
          {coverageOk === true && (
            <p className="mt-1.5 text-[11px] text-text-secondary">{t("perf.coverageOk")}</p>
          )}
          {main?.average_interval_width != null && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-secondary">{t("perf.avgInterval")}</span>
              <span className="tnum">{main.average_interval_width.toFixed(2)} MW</span>
            </div>
          )}
          {main?.pinball_loss != null && (
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-text-secondary">{t("perf.pinball")}</span>
              <span className="tnum">{main.pinball_loss.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
