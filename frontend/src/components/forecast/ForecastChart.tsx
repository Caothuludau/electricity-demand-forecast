import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { useI18n } from "@/lib/i18n";
import { formatHour, formatMW } from "@/lib/utils";
import type { ForecastPoint } from "@/types/api";

interface ChartDatum {
  timestamp: number;
  label: string;
  actual: number | null;
  p50: number | null;
  band: [number | null, number | null];
  capacity: number | null;
  risk: string;
}

/** Marks the transition from history (P50 null) to forecast window. */
function useForecastStart(data: ChartDatum[]): number | null {
  return useMemo(() => {
    for (const d of data) {
      if (d.p50 !== null) return d.timestamp;
    }
    return null;
  }, [data]);
}

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const { t } = useI18n();
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  const data: ChartDatum[] = useMemo(
    () =>
      points.map((p) => ({
        timestamp: new Date(p.timestamp).getTime(),
        label: formatHour(p.timestamp),
        actual: p.actual,
        p50: p.p50,
        band: p.p10 !== null && p.p90 !== null ? [p.p10, p.p90] : [null, null],
        capacity: p.capacity,
        risk: p.risk_level,
      })),
    [points],
  );

  const forecastStart = useForecastStart(data);

  const viewData = useMemo(() => {
    if (!zoomDomain) return data;
    const [lo, hi] = zoomDomain;
    return data.filter((d) => d.timestamp >= lo && d.timestamp <= hi);
  }, [data, zoomDomain]);

  const fullDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [0, 1];
    return [data[0].timestamp, data[data.length - 1].timestamp];
  }, [data]);

  const yBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const d of viewData) {
      const candidates = [d.actual, d.band[0], d.band[1], d.capacity, d.p50];
      for (const v of candidates) {
        if (v !== null && !Number.isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (min === Infinity) return { min: 0, max: 1 };
    const pad = (max - min) * 0.08 || 0.5;
    return { min: Math.max(0, min - pad), max: max + pad };
  }, [viewData]);

  const hasForecast = forecastStart !== null;

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center text-sm text-text-muted">
        {t("fc.noData")}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
        <LegendItem color={colors.actual} label={t("fc.legendActual")} />
        {hasForecast && (
          <>
            <LegendItem color={colors.forecast} label={t("fc.legendForecast")} />
            <LegendItem color={colors.band} label={t("fc.legendBand")} swatch />
          </>
        )}
        <LegendItem color={colors.capacity} label={t("fc.legendCapacity")} dashed />
        <div className="ml-auto flex items-center gap-2">
          {zoomDomain && (
            <button
              type="button"
              onClick={() => setZoomDomain(null)}
              className="rounded border border-border-strong px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {t("fc.resetZoom")}
            </button>
          )}
          <span className="hidden text-[10px] text-text-muted lg:inline">
            {t("fc.dragToZoom")}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart
          data={viewData}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          onMouseDown={(state: unknown) => {
            const s = state as { chartX?: number; activeLabel?: unknown } | null;
            if (s && typeof s.activeLabel === "string") {
              const t = new Date(s.activeLabel).getTime();
              if (!Number.isNaN(t)) setZoomDomain([t, t]);
            }
          }}
          onMouseMove={(state: unknown) => {
            const s = state as { chartX?: number; activeLabel?: unknown; isTooltipActive?: boolean } | null;
            if (!s?.isTooltipActive || typeof s.activeLabel !== "string") return;
            const t = new Date(s.activeLabel).getTime();
            if (Number.isNaN(t)) return;
            setZoomDomain((prev) => {
              if (!prev) return prev;
              const [lo, hi] = prev;
              if (lo === hi) return [Math.min(lo, t), Math.max(hi, t)];
              if (t < lo || t > hi) return [lo, hi]; // outside drag
              return [Math.min(lo, t), Math.max(hi, t)];
            });
          }}
          onMouseUp={() => {
            setZoomDomain((prev) => {
              if (!prev) return null;
              const [lo, hi] = prev;
              // treat tiny selections as no-op
              return hi - lo > 3600_000 ? prev : null;
            });
          }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={zoomDomain ?? fullDomain}
            tickFormatter={(t: number) => formatHour(new Date(t).toISOString())}
            {...axisProps}
            minTickGap={48}
          />
          <YAxis
            domain={[yBounds.min, yBounds.max]}
            tickFormatter={(v: number) => v.toFixed(1)}
            {...axisProps}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(t) =>
              new Date(Number(t)).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            }
            formatter={(value, name) => {
              if (name === "band" || value === null || value === undefined) return null;
              const labelMap: Record<string, string> = {
                actual: t("fc.tooltipActual"),
                p50: t("fc.tooltipForecast"),
                capacity: t("fc.tooltipCapacity"),
              };
              return [formatMW(Number(value), 2), labelMap[String(name)] ?? String(name)];
            }}
          />
          {viewData.some((d) => d.band[0] !== null) && (
            <Area
              dataKey="band"
              stroke="none"
              fill={colors.band}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={colors.actual}
            strokeWidth={1.8}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke={colors.forecast}
            strokeWidth={1.8}
            strokeDasharray="0"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="capacity"
            stroke={colors.capacity}
            strokeWidth={1.4}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
          {/* highlight risk hours within the forecast window */}
          {viewData.some((d) => d.risk !== "low" && d.risk !== "unknown" && d.p50 !== null) && (
            <Line
              type="monotone"
              dataKey={(d: ChartDatum) => (d.risk === "high" ? d.p50 : null)}
              stroke={colors.riskHigh}
              strokeWidth={0}
              dot={{ r: 3, fill: colors.riskHigh, stroke: "none" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed,
  swatch,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  swatch?: boolean;
}) {
  if (swatch) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm" style={{ background: color }} />
        {label}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6">
        <line
          x1="0"
          y1="3"
          x2="18"
          y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
