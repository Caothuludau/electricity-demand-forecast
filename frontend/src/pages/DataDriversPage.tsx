import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { Panel } from "@/components/ui/primitives";
import { ChartSkeleton } from "@/components/ui/states";
import { useDataQuality, useWeather } from "@/hooks/useApi";
import { useI18n } from "@/lib/i18n";

function WeatherScatter({
  data,
  xKey,
  color,
}: {
  data: Record<string, number>[];
  xKey: string;
  color: string;
}) {
  const { t } = useI18n();
  const { tooltipStyle, axisProps, gridProps } = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey={xKey}
          type="number"
          tickFormatter={(v: number) => v.toFixed(0)}
          {...axisProps}
        />
        <YAxis dataKey="load" tickFormatter={(v: number) => v.toFixed(2)} {...axisProps} width={48} />
        <ZAxis range={[8, 8]} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) =>
            name === "load"
              ? [`${Number(value).toFixed(3)} MW`, t("drv.load")]
              : [Number(value).toFixed(2), String(name)]
          }
        />
        <Scatter data={data} fill={color} fillOpacity={0.35} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function DataDriversPage() {
  const { t } = useI18n();
  const { colors } = useChartTheme();
  const { data: weather, isLoading, isError, error } = useWeather(3000);
  const { data: quality } = useDataQuality();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Panel key={i} title={t("state.loading")}>
            <ChartSkeleton height={240} />
          </Panel>
        ))}
      </div>
    );
  }
  if (isError) return <p className="py-8 text-sm text-risk-high">{t("state.weatherFail")}{error.message}</p>;
  if (!weather) return null;

  const rows = weather.points.map((p) => ({
    temp: p.temperature,
    humidity: p.humidity,
    wind: p.wind_speed,
    load: p.total_power,
  }));

  return (
    <div className="space-y-6">
      <Panel title={t("drv.title")} subtitle={t("drv.subtitle")}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-medium text-text-secondary">{t("drv.temp")}</div>
            <WeatherScatter data={rows} xKey="temp" color={colors.forecast} />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-text-secondary">{t("drv.humidity")}</div>
            <WeatherScatter data={rows} xKey="humidity" color={colors.zone2} />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-text-secondary">{t("drv.wind")}</div>
            <WeatherScatter data={rows} xKey="wind" color={colors.zone3} />
          </div>
        </div>
      </Panel>

      {quality && (
        <Panel title={t("drv.qualityTitle")} subtitle={t("drv.qualitySub")}>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
            <Item label={t("drv.rawObs")} value={t("drv.rowsAt", { n: quality.raw_rows.toLocaleString(), f: quality.raw_frequency })} />
            <Item label={t("drv.rawPeriod")} value={`${quality.raw_start} → ${quality.raw_end}`} />
            <Item label={t("drv.hourlySeries")} value={t("drv.rows", { n: quality.hourly_rows.toLocaleString() })} />
            <Item label={t("drv.hourlyPeriod")} value={`${quality.hourly_start} → ${quality.hourly_end}`} />
            <Item label={t("drv.missing")} value={quality.missing_timestamps === 0 ? t("drv.none") : String(quality.missing_timestamps)} good={quality.missing_timestamps === 0} />
            <Item label={t("drv.nulls")} value={quality.null_values === 0 ? t("drv.none") : String(quality.null_values)} good={quality.null_values === 0} />
          </dl>
          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-text-secondary">
            <p>
              <span className="text-text-muted">{t("drv.aggregation")}</span> {quality.aggregation}
            </p>
            <p>
              <span className="text-text-muted">{t("drv.totalDef")}</span> {quality.total_power_definition}
            </p>
            <p>
              <span className="text-text-muted">{t("drv.units")}</span> {quality.units}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Item({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-text-muted uppercase">{label}</dt>
      <dd className={`tnum mt-0.5 text-[13px] ${good === true ? "text-risk-low" : "text-text-primary"}`}>
        {value}
      </dd>
    </div>
  );
}
