/** Typed API contracts mirroring the FastAPI schemas. All loads in MW. */

export type RiskLevel = "low" | "medium" | "high" | "unknown";
export type Granularity = "hourly" | "daily";
export type ZoneKey = "total" | "zone1" | "zone2" | "zone3";

export interface OverviewResponse {
  latest_timestamp: string;
  current_load_mw: number | null;
  next_forecast_mw: number | null;
  next_forecast_timestamp: string | null;
  p10_mw: number | null;
  p90_mw: number | null;
  capacity_mw: number;
  risk_level: RiskLevel;
  reserve_margin: number;
  required_capacity_mw: number | null;
  next_risk_window: { timestamp: string; risk_level: RiskLevel } | null;
  data_start: string;
  data_end: string;
  forecast_available: boolean;
}

export interface HistoryPoint {
  timestamp: string;
  zone1: number | null;
  zone2: number | null;
  zone3: number | null;
  total_power: number | null;
}

export interface HistoryResponse {
  granularity: Granularity;
  zone: ZoneKey;
  points: HistoryPoint[];
}

export interface ForecastPoint {
  timestamp: string;
  actual: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  capacity: number | null;
  risk_level: RiskLevel;
}

export interface ForecastResponse {
  points: ForecastPoint[];
}

export interface PeakWindow {
  timestamp: string;
  forecast_mw: number | null;
  p90_mw: number | null;
  capacity_mw: number;
  risk_level: RiskLevel;
  breach: boolean;
}

export interface PeakWindowsResponse {
  windows: PeakWindow[];
}

export interface CapacityScenario {
  reserve_margin: number;
  forecast_peak_mw: number;
  required_capacity_mw: number;
  current_capacity_mw: number;
  additional_capacity_required_mw: number;
}

export interface CapacityScenariosResponse {
  current_capacity_mw: number;
  scenarios: CapacityScenario[];
}

export interface ModelEvaluation {
  model: string;
  MAE: number;
  RMSE: number;
  WAPE: number;
  peak_magnitude_error: number | null;
  peak_magnitude_error_pct: number | null;
  peak_timing_error_hours: number | null;
  actual_peak: number | null;
  predicted_peak: number | null;
  pinball_loss: number | null;
  pinball_loss_p10: number | null;
  pinball_loss_p50: number | null;
  pinball_loss_p90: number | null;
  coverage: number | null;
  average_interval_width: number | null;
}

export interface ModelMetricsResponse {
  capacity_threshold: number;
  capacity_quantile: number;
  test_window: { start: string; end: string };
  target_coverage: number;
  models: ModelEvaluation[];
}

export interface HourlyProfilePoint {
  hour: number;
  avg_load_mw: number;
  p10_mw: number;
  p90_mw: number;
}

export interface WeekdayWeekendPoint {
  hour: number;
  weekday_mw: number | null;
  weekend_mw: number | null;
}

export interface ZoneContributionPoint {
  hour: number;
  zone1_mw: number;
  zone2_mw: number;
  zone3_mw: number;
}

export interface MonthlyDistributionPoint {
  month: number;
  min_mw: number;
  q1_mw: number;
  median_mw: number;
  q3_mw: number;
  max_mw: number;
  outliers_mw: (number | null)[];
}

export interface WeatherSample {
  timestamp: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  total_power: number;
}

export interface WeatherResponse {
  points: WeatherSample[];
}

export interface DataQualityResponse {
  raw_rows: number;
  raw_frequency: string;
  raw_start: string;
  raw_end: string;
  hourly_rows: number;
  hourly_start: string;
  hourly_end: string;
  aggregation: string;
  total_power_definition: string;
  units: string;
  missing_timestamps: number;
  null_values: number;
  generated_at: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  datasets_loaded: Record<string, boolean>;
  data_start: string | null;
  data_end: string | null;
}
