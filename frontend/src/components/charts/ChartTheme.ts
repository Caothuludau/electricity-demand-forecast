/** Shared chart color tokens + tooltip styling, per theme mode. */
import { useTheme } from "@/lib/theme";

const dark = {
  actual: "#e6edf3",
  forecast: "#38bdf8",
  band: "rgba(56, 189, 248, 0.16)",
  bandBorder: "rgba(56, 189, 248, 0.45)",
  capacity: "#f97316",
  riskLow: "#34d399",
  riskMedium: "#fbbf24",
  riskHigh: "#f87171",
  grid: "#1c2531",
  axis: "#5c6878",
  zone1: "#38bdf8",
  zone2: "#a78bfa",
  zone3: "#34d399",
  weekday: "#38bdf8",
  weekend: "#fbbf24",
  tooltipBg: "#11161d",
  tooltipBorder: "#313d4d",
  tooltipText: "#e6edf3",
  barDim: "rgba(139, 152, 169, 0.45)",
  cursor: "rgba(56, 189, 248, 0.06)",
};

const light = {
  actual: "#17212e",
  forecast: "#0284c7",
  band: "rgba(2, 132, 199, 0.12)",
  bandBorder: "rgba(2, 132, 199, 0.45)",
  capacity: "#ea580c",
  riskLow: "#059669",
  riskMedium: "#d97706",
  riskHigh: "#dc2626",
  grid: "#e2e8f0",
  axis: "#64748b",
  zone1: "#0284c7",
  zone2: "#7c3aed",
  zone3: "#059669",
  weekday: "#0284c7",
  weekend: "#d97706",
  tooltipBg: "#ffffff",
  tooltipBorder: "#b8c4d0",
  tooltipText: "#17212e",
  barDim: "rgba(81, 96, 122, 0.40)",
  cursor: "rgba(2, 132, 199, 0.06)",
};

export function useChartTheme() {
  const { mode } = useTheme();
  const c = mode === "light" ? light : dark;
  return {
    colors: c,
    tooltipStyle: {
      backgroundColor: c.tooltipBg,
      border: `1px solid ${c.tooltipBorder}`,
      borderRadius: 6,
      fontSize: 12,
      color: c.tooltipText,
    },
    axisProps: {
      stroke: c.axis,
      tick: { fill: c.axis, fontSize: 11 },
      tickLine: false,
    },
    gridProps: {
      stroke: c.grid,
      strokeDasharray: "3 3",
      vertical: false,
    },
  } as const;
}
