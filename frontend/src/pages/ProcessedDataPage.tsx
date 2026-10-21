import { useQuery } from "@tanstack/react-query";

import { Panel, TimeLine } from "@/components/charts/SimpleCharts";
import { ErrorState } from "@/components/ui/states";
import { formatPower, formatTimestamp } from "@/lib/utils";
import { api } from "@/services/api";

export function ProcessedDataPage() {
  const query = useQuery({ queryKey: ["processed"], queryFn: api.processed });
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading processed data…</p>;
  if (query.error || !query.data) return <ErrorState message={(query.error as Error)?.message ?? "Failed"} onRetry={() => query.refetch()} />;

  const { daily, recent_hourly: recent, rows, start, end } = query.data;
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        {rows.toLocaleString()} hourly means from {formatTimestamp(start)} to {formatTimestamp(end)}. Each hour is the mean of six 10-minute readings.
      </p>
      <Panel title="Daily mean total power">
        <TimeLine
          data={daily.map((point) => ({
            label: formatTimestamp(point.datetime),
            total_power: point.total_power,
          }))}
          lines={[{ key: "total_power", name: "Daily mean", color: "#D71920" }]}
        />
      </Panel>
      <Panel title="Latest 72 hours by zone">
        <TimeLine
          data={recent.map((point) => ({
            label: formatTimestamp(point.datetime),
            total_power: point.total_power,
            zone_1_power: point.zone_1_power,
            zone_2_power: point.zone_2_power,
            zone_3_power: point.zone_3_power,
          }))}
          lines={[
            { key: "total_power", name: "Total", color: "#8B1014" },
            { key: "zone_1_power", name: "Zone 1", color: "#D71920" },
            { key: "zone_2_power", name: "Zone 2", color: "#4C78A8" },
            { key: "zone_3_power", name: "Zone 3", color: "#59A14F" },
          ]}
        />
      </Panel>
      <Panel title="Latest hourly rows">
        <table className="w-full text-left text-xs">
          <thead className="text-text-muted">
            <tr>
              <th className="py-1 pr-3">Hour</th>
              <th className="py-1 pr-3">Total</th>
              <th className="py-1 pr-3">Zone 1</th>
              <th className="py-1 pr-3">Zone 2</th>
              <th className="py-1">Zone 3</th>
            </tr>
          </thead>
          <tbody>
            {recent.slice(-12).map((point) => (
              <tr key={point.datetime} className="border-t border-border">
                <td className="py-1 pr-3">{formatTimestamp(point.datetime)}</td>
                <td className="py-1 pr-3">{formatPower(point.total_power)}</td>
                <td className="py-1 pr-3">{formatPower(point.zone_1_power)}</td>
                <td className="py-1 pr-3">{formatPower(point.zone_2_power)}</td>
                <td className="py-1">{formatPower(point.zone_3_power)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
