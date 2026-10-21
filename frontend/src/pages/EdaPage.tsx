import { useQuery } from "@tanstack/react-query";

import { Bars, Heatmap, Panel, ScatterPanel, TimeLine } from "@/components/charts/SimpleCharts";
import { ErrorState } from "@/components/ui/states";
import { formatPower, formatTimestamp } from "@/lib/utils";
import { api } from "@/services/api";

export function EdaPage() {
  const query = useQuery({ queryKey: ["eda"], queryFn: api.eda });
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading EDA…</p>;
  if (query.error || !query.data) return <ErrorState message={(query.error as Error)?.message ?? "Failed"} onRetry={() => query.refetch()} />;
  const data = query.data;
  const timeline = data.timeline.filter((_, index) => index % 3 === 0);

  return (
    <div className="space-y-4">
      <Panel title="Total hourly electricity demand in 2017">
        <TimeLine
          data={timeline.map((point) => ({
            label: formatTimestamp(point.datetime),
            total_power: point.total_power,
          }))}
          lines={[{ key: "total_power", name: "Total power", color: "#D71920" }]}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Daily load profile">
          <TimeLine
            data={data.hourly_profile.map((point) => ({
              label: String(point.hour),
              mean: point.mean,
              median: point.median,
            }))}
            lines={[
              { key: "mean", name: "Mean", color: "#D71920" },
              { key: "median", name: "Median", color: "#8B1014" },
            ]}
          />
        </Panel>
        <Panel title="Weekday and weekend in hours">
          <TimeLine
            data={data.weekday_weekend.map((point) => ({
              label: String(point.hour),
              weekday: point.weekday,
              weekend: point.weekend,
            }))}
            lines={[
              { key: "weekday", name: "Weekday", color: "#D71920" },
              { key: "weekend", name: "Weekend", color: "#4C78A8" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Heatmap of electricity demand: weekday × hour">
        <Heatmap
          rows={data.day_hour.days}
          cols={data.day_hour.hours.map(String)}
          values={data.day_hour.values}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Average total load month over month">
          <TimeLine
            data={data.monthly_mean.map((point) => ({ label: String(point.month), mean: point.mean }))}
            lines={[{ key: "mean", name: "Mean", color: "#D71920" }]}
          />
        </Panel>
        <Panel title="Monthly total power distribution">
          <TimeLine
            data={data.monthly_box.map((point) => ({
              label: String(point.month),
              min: point.min,
              median: point.median,
              max: point.max,
            }))}
            lines={[
              { key: "min", name: "Min", color: "#8B1014" },
              { key: "median", name: "Median", color: "#D71920" },
              { key: "max", name: "Max", color: "#4C78A8" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Average power by zone">
        <Bars
          data={data.zones.map((zone) => ({
            zone: zone.zone.replaceAll("_", " "),
            mean: zone.mean,
            share: zone.share * 100,
          }))}
          xKey="zone"
          bars={[{ key: "mean", name: "Mean power", color: "#D71920" }]}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Temperature and total power">
          <ScatterPanel data={data.scatter} xKey="temperature" name="Temperature" />
        </Panel>
        <Panel title="Humidity and total power">
          <ScatterPanel data={data.scatter} xKey="humidity" name="Humidity" />
        </Panel>
      </div>
      <Panel title="Hourly data correlation matrix">
        <Heatmap
          rows={data.correlation.labels}
          cols={data.correlation.labels}
          values={data.correlation.values}
          diverging
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Peak hours above P95 (${formatPower(data.p95)})`}>
          <Bars
            data={data.peak_by_hour.map((point) => ({ hour: String(point.hour), count: point.count }))}
            xKey="hour"
            bars={[{ key: "count", name: "Hours", color: "#D71920" }]}
          />
        </Panel>
        <Panel title="Peak hours above P95 by month">
          <Bars
            data={data.peak_by_month.map((point) => ({ month: String(point.month), count: point.count }))}
            xKey="month"
            bars={[{ key: "count", name: "Hours", color: "#D71920" }]}
          />
        </Panel>
      </div>
    </div>
  );
}
