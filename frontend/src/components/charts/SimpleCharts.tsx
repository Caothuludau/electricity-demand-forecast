import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartTheme } from "@/components/charts/ChartTheme";
import { formatPower } from "@/lib/utils";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

export function TimeLine({
  data,
  lines,
}: {
  data: Record<string, string | number | null>[];
  lines: { key: string; name: string; color: string }[];
}) {
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} minTickGap={28} />
          <YAxis {...axisProps} tickFormatter={(value) => formatPower(Number(value))} width={64} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatPower(typeof value === "number" ? value : null)}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color || colors.forecast}
              dot={false}
              strokeWidth={1.6}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({
  data,
  xKey,
  bars,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  bars: { key: string; name: string; color: string }[];
}) {
  const { tooltipStyle, axisProps, gridProps } = useChartTheme();
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} fill={bar.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScatterPanel({
  data,
  xKey,
  name,
}: {
  data: Record<string, number>[];
  xKey: string;
  name: string;
}) {
  const { colors, tooltipStyle, axisProps, gridProps } = useChartTheme();
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} name={name} {...axisProps} />
          <YAxis dataKey="total_power" name="Total power" {...axisProps} tickFormatter={(value) => formatPower(Number(value))} width={64} />
          <Tooltip contentStyle={tooltipStyle} />
          <Scatter data={data} fill={colors.forecast} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Heatmap({
  rows,
  cols,
  values,
  diverging = false,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  diverging?: boolean;
}) {
  const flat = values.flat().filter((value): value is number => value !== null);
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const color = (value: number | null) => {
    if (value === null || flat.length === 0) return "transparent";
    const t = diverging ? (value + 1) / 2 : (value - min) / (max - min || 1);
    const clamped = Math.min(1, Math.max(0, t));
    const red = Math.round(215 + (1 - clamped) * 40);
    const green = Math.round(40 + clamped * 180);
    const blue = Math.round(32 + (1 - clamped) * 160);
    return `rgb(${red}, ${green}, ${blue})`;
  };
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            <th />
            {cols.map((col) => (
              <th key={col} className="px-1 font-normal text-text-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row}>
              <th className="pr-2 text-left font-normal text-text-secondary">{row}</th>
              {cols.map((col, colIndex) => {
                const value = values[rowIndex]?.[colIndex] ?? null;
                return (
                  <td
                    key={col}
                    title={value === null ? "" : String(value)}
                    className="h-5 min-w-5 border border-bg"
                    style={{ background: color(value) }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
