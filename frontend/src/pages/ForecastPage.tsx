import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Panel, TimeLine } from "@/components/charts/SimpleCharts";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatPower, formatTimestamp } from "@/lib/utils";
import { api, ApiError } from "@/services/api";

export function ForecastPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["forecast-store"], queryFn: api.storedForecast });
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: api.importForecast,
    onSuccess: async (result) => {
      setError(null);
      setMessage(`Saved ${result.rows_imported} rows and ${result.forecasts.length} forecast hour${result.forecasts.length === 1 ? "" : "s"}.`);
      await queryClient.invalidateQueries({ queryKey: ["forecast-store"] });
      await queryClient.invalidateQueries({ queryKey: ["raw"] });
      await queryClient.invalidateQueries({ queryKey: ["processed"] });
      await queryClient.invalidateQueries({ queryKey: ["eda"] });
    },
    onError: (reason: Error) => {
      setMessage(null);
      setError(reason instanceof ApiError ? reason.message : reason.message);
    },
  });

  if (query.isLoading) return <p className="text-sm text-text-muted">Loading forecasts…</p>;
  if (query.error || !query.data) return <ErrorState message={(query.error as Error)?.message ?? "Failed"} onRetry={() => query.refetch()} />;

  const forecasts = query.data.forecasts;
  return (
    <div className="space-y-4">
      <Panel title="Import 10-minute readings">
        <p className="mb-3 text-xs text-text-secondary">
          Upload a CSV with the same columns as the training file. New hours need six readings each, continuing the 10-minute series. The saved model forecasts the following hour and the rows are stored.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            if (!chosen) {
              setError("Choose a CSV file first.");
              return;
            }
            setError(null);
            setMessage(null);
            upload.mutate(chosen);
          }}
        />
        <button
          type="button"
          disabled={upload.isPending}
          onClick={() => fileInput.current?.click()}
          className="rounded border border-border-strong px-3 py-1.5 text-xs text-text-primary hover:border-accent disabled:opacity-60"
        >
          {upload.isPending ? "Scoring…" : "Import and forecast"}
        </button>
        {message && <p className="mt-2 text-xs text-text-secondary">{message}</p>}
        {error && <p className="mt-2 text-xs text-risk-high">{error}</p>}
      </Panel>
      {forecasts.length === 0 ? (
        <EmptyState title="No imported forecasts yet" description="Import a CSV of new 10-minute readings to score the trained model." />
      ) : (
        <>
          <Panel title="Saved 1-hour-ahead forecasts">
            <TimeLine
              data={forecasts.map((point) => ({
                label: formatTimestamp(point.forecast_time),
                actual: point.actual_target_t_plus_1,
                forecast: point.pred_selected,
              }))}
              lines={[
                { key: "actual", name: "Actual", color: "#8B1014" },
                { key: "forecast", name: "Selected model", color: "#4C78A8" },
              ]}
            />
          </Panel>
          <Panel title="Forecast rows">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3">Forecast hour</th>
                  <th className="py-1 pr-3">LightGBM</th>
                  <th className="py-1 pr-3">XGBoost</th>
                  <th className="py-1 pr-3">Ensemble</th>
                  <th className="py-1 pr-3">Selected</th>
                  <th className="py-1">Actual</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((point) => (
                  <tr key={point.forecast_time} className="border-t border-border">
                    <td className="py-1 pr-3">{formatTimestamp(point.forecast_time)}</td>
                    <td className="py-1 pr-3">{formatPower(point.pred_lightgbm, 1)}</td>
                    <td className="py-1 pr-3">{formatPower(point.pred_xgboost, 1)}</td>
                    <td className="py-1 pr-3">{formatPower(point.pred_ensemble, 1)}</td>
                    <td className="py-1 pr-3">{formatPower(point.pred_selected, 1)}</td>
                    <td className="py-1">{formatPower(point.actual_target_t_plus_1, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
