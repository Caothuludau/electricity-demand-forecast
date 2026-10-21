import { useQuery } from "@tanstack/react-query";

import { Bars, Panel, TimeLine } from "@/components/charts/SimpleCharts";
import { ErrorState } from "@/components/ui/states";
import { formatPower, formatTimestamp } from "@/lib/utils";
import { api } from "@/services/api";
import type { MetricRow } from "@/types/viz";

export function ModelPage() {
  const query = useQuery({ queryKey: ["model"], queryFn: api.modelEvaluation });
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading model…</p>;
  if (query.error || !query.data) return <ErrorState message={(query.error as Error)?.message ?? "Failed"} onRetry={() => query.refetch()} />;
  const data = query.data;
  const selectedKey = data.selected_model.toLowerCase();

  return (
    <div className="space-y-4">
      <Panel title="Selected model">
        <p className="text-sm text-text-primary">{data.selected_model}</p>
        <p className="mt-1 text-xs text-text-secondary">{data.selection_note}</p>
        <p className="mt-2 text-xs text-text-muted">
          Ensemble weights: LightGBM {(data.weight_lightgbm * 100).toFixed(0)}% · XGBoost {(data.weight_xgboost * 100).toFixed(0)}%. {data.feature_columns.length} predictors. Capacity P90 {formatPower(data.capacity_p90)}.
        </p>
      </Panel>
      <Panel title="WAPE by backtest fold">
        <Bars
          data={data.fold_wape
            .filter((row) => ["naive_24h", "LightGBM", "XGBoost", "Ensemble"].includes(row.model))
            .map((row) => ({
              model: row.model,
              Sep: row.Fold_09_2017 ?? null,
              Oct: row.Fold_10_2017 ?? null,
              Nov: row.Fold_11_2017 ?? null,
            }))}
          xKey="model"
          bars={[
            { key: "Sep", name: "Sep 2017", color: "#D71920" },
            { key: "Oct", name: "Oct 2017", color: "#4C78A8" },
            { key: "Nov", name: "Nov 2017", color: "#59A14F" },
          ]}
        />
      </Panel>
      <Panel title="Final holdout (Dec 2017): actual and 1-hour-ahead forecast">
        <TimeLine
          data={data.holdout_series.map((point) => ({
            label: formatTimestamp(point.forecast_time),
            actual: point.actual,
            forecast: point[selectedKey as "lightgbm" | "xgboost" | "ensemble"],
          }))}
          lines={[
            { key: "actual", name: "Actual", color: "#8B1014" },
            { key: "forecast", name: data.selected_model, color: "#4C78A8" },
          ]}
        />
      </Panel>
      <Panel title="Holdout metrics">
        <MetricTable
          rows={data.holdout_metrics}
          columns={["model", "MAE", "RMSE", "WAPE_pct", "MASE", "Bias"]}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Reserve margin: missed peaks and extra flags">
          <Bars
            data={data.reserve_margins.map((row) => ({
              margin: row.reserve_margin,
              missed: row.FN_missed,
              extra: row.FP_over_provision,
            }))}
            xKey="margin"
            bars={[
              { key: "missed", name: "Missed", color: "#D71920" },
              { key: "extra", name: "Extra reserve", color: "#4C78A8" },
            ]}
          />
        </Panel>
        <Panel title="Daily peak errors, Sep–Dec 2017">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Days" value={String(data.peak_summary.n_days)} />
            <Stat label="Peak magnitude MAE" value={formatPower(data.peak_summary.peak_magnitude_mae, 1)} />
            <Stat label="Peak MAPE" value={`${data.peak_summary.peak_magnitude_mape_pct.toFixed(2)}%`} />
            <Stat label="Mean timing error" value={`${data.peak_summary.mean_timing_error_hours.toFixed(2)} h`} />
            <Stat label="Peaks within ±1 hour" value={`${(data.peak_summary.within_one_hour_share * 100).toFixed(0)}%`} />
          </dl>
        </Panel>
      </div>
      <Panel title="Feature importance of the selected model">
        <Bars
          data={data.feature_importance.slice(0, 12).map((row) => ({
            feature: row.feature.replaceAll("_", " "),
            importance: row.importance,
          }))}
          xKey="feature"
          bars={[{ key: "importance", name: "Importance", color: "#D71920" }]}
        />
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}

function MetricTable({ rows, columns }: { rows: MetricRow[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="py-1 pr-3">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model} className="border-t border-border">
              {columns.map((column) => {
                const value = row[column as keyof MetricRow];
                const digits = column === "WAPE_pct" || column === "MASE" ? 2 : 1;
                return (
                  <td key={column} className="py-1 pr-3">
                    {typeof value === "number" ? formatPower(value, digits) : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
