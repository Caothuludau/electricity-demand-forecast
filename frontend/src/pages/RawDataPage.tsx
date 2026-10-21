import { useQuery } from "@tanstack/react-query";

import { Panel, TimeLine } from "@/components/charts/SimpleCharts";
import { ErrorState } from "@/components/ui/states";
import { api } from "@/services/api";
import { formatPower, formatTimestamp } from "@/lib/utils";

export function RawDataPage() {
  const query = useQuery({ queryKey: ["raw"], queryFn: () => api.raw({ limit: 12, offset: 0 }) });
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading raw data…</p>;
  if (query.error || !query.data) return <ErrorState message={(query.error as Error)?.message ?? "Failed"} onRetry={() => query.refetch()} />;

  const { quality, preview, rows, total_rows: totalRows } = query.data;
  const checks = [
    ["Rows", quality.rows.toLocaleString()],
    ["Start", formatTimestamp(quality.start)],
    ["End", formatTimestamp(quality.end)],
    ["Duplicate timestamps", quality.duplicate_timestamps],
    ["Missing values", quality.missing_values],
    ["Irregular 10-minute steps", quality.irregular_intervals],
    ["Negative power", quality.negative_power],
    ["Humidity outside 0–100", quality.invalid_humidity],
  ];

  return (
    <div className="space-y-4">
      <Panel title="10-minute quality checks">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {checks.map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[11px] text-text-muted">{label}</dt>
              <dd className="text-sm text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Latest day of 10-minute total power">
        <TimeLine
          data={preview.map((point) => ({
            label: formatTimestamp(point.datetime),
            total_power: point.total_power,
          }))}
          lines={[{ key: "total_power", name: "Total power", color: "#D71920" }]}
        />
      </Panel>
      <Panel title={`First rows of ${totalRows.toLocaleString()}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-text-muted">
              <tr>
                <th className="py-1 pr-3">Time</th>
                <th className="py-1 pr-3">Temp</th>
                <th className="py-1 pr-3">Humidity</th>
                <th className="py-1 pr-3">Zone 1</th>
                <th className="py-1 pr-3">Zone 2</th>
                <th className="py-1">Zone 3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.datetime} className="border-t border-border">
                  <td className="py-1 pr-3">{formatTimestamp(row.datetime)}</td>
                  <td className="py-1 pr-3">{row.temperature.toFixed(2)}</td>
                  <td className="py-1 pr-3">{row.humidity.toFixed(1)}</td>
                  <td className="py-1 pr-3">{formatPower(row.zone_1_power)}</td>
                  <td className="py-1 pr-3">{formatPower(row.zone_2_power)}</td>
                  <td className="py-1">{formatPower(row.zone_3_power)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
