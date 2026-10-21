export interface QualityReport {
  rows: number;
  start: string;
  end: string;
  duplicate_timestamps: number;
  missing_values: number;
  irregular_intervals: number;
  negative_power: number;
  invalid_humidity: number;
}

export interface RawRow {
  datetime: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  general_diffuse_flows: number;
  diffuse_flows: number;
  zone_1_power: number;
  zone_2_power: number;
  zone_3_power: number;
}

export interface RawResponse {
  quality: QualityReport;
  total_rows: number;
  offset: number;
  rows: RawRow[];
  preview: { datetime: string; total_power: number }[];
}

export interface SeriesPoint {
  datetime: string;
  total_power: number | null;
  zone_1_power: number | null;
  zone_2_power: number | null;
  zone_3_power: number | null;
}

export interface ProcessedResponse {
  rows: number;
  start: string;
  end: string;
  daily: SeriesPoint[];
  recent_hourly: SeriesPoint[];
}

export interface EdaResponse {
  timeline: { datetime: string; total_power: number }[];
  hourly_profile: { hour: number; mean: number; median: number }[];
  weekday_weekend: { hour: number; weekday: number | null; weekend: number | null }[];
  monthly_mean: { month: number; mean: number }[];
  monthly_box: { month: number; min: number; q1: number; median: number; q3: number; max: number }[];
  zones: { zone: string; mean: number; share: number }[];
  p95: number;
  peak_by_hour: { hour: number; count: number }[];
  peak_by_month: { month: number; count: number }[];
  day_hour: { days: string[]; hours: number[]; values: (number | null)[][] };
  correlation: { labels: string[]; values: number[][] };
  scatter: { temperature: number; humidity: number; total_power: number }[];
}

export interface MetricRow {
  model: string;
  MAE?: number;
  RMSE?: number;
  WAPE_pct?: number;
  MASE?: number;
  Bias?: number;
  WAPE_std?: number;
  n?: number;
  backtest_wape_mean?: number;
  backtest_wape_std?: number;
  holdout_wape?: number;
  holdout_mase?: number;
  Fold_09_2017?: number;
  Fold_10_2017?: number;
  Fold_11_2017?: number;
}

export interface HoldoutPoint {
  forecast_time: string;
  actual: number;
  lightgbm: number;
  xgboost: number;
  ensemble: number;
}

export interface ModelResponse {
  selected_model: string;
  weight_lightgbm: number;
  weight_xgboost: number;
  feature_columns: string[];
  feature_importance: { feature: string; importance: number }[];
  fold_wape: MetricRow[];
  summary: MetricRow[];
  holdout_metrics: MetricRow[];
  holdout_series: HoldoutPoint[];
  capacity_p90: number;
  reserve_margins: {
    reserve_margin: string;
    FN_missed: number;
    FP_over_provision: number;
    recall: number;
    precision: number;
  }[];
  peak_summary: {
    n_days: number;
    peak_magnitude_mae: number;
    peak_magnitude_mape_pct: number;
    mean_timing_error_hours: number;
    within_one_hour_share: number;
  };
  comparison: MetricRow[];
  selection_note: string;
}

export interface SavedForecast {
  forecast_time: string;
  pred_lightgbm: number;
  pred_xgboost: number;
  pred_ensemble: number;
  pred_selected: number;
  actual_target_t_plus_1: number | null;
}

export interface ForecastStore {
  observations: {
    datetime: string;
    temperature: number;
    humidity: number;
    wind_speed: number;
    zone_1_power: number;
    zone_2_power: number;
    zone_3_power: number;
  }[];
  forecasts: SavedForecast[];
}

export interface ImportResult {
  rows_imported: number;
  forecasts: SavedForecast[];
}
