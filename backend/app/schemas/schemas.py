"""Pydantic response schemas. All loads are expressed in MW."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

RiskLevel = Literal["low", "medium", "high", "unknown"]


class OverviewResponse(BaseModel):
    latest_timestamp: str
    current_load_mw: Optional[float]
    next_forecast_mw: Optional[float]
    next_forecast_timestamp: Optional[str]
    p10_mw: Optional[float]
    p90_mw: Optional[float]
    capacity_mw: float
    risk_level: RiskLevel
    reserve_margin: float
    required_capacity_mw: Optional[float]
    next_risk_window: Optional[dict]
    data_start: str
    data_end: str
    forecast_available: bool


class HistoryPoint(BaseModel):
    timestamp: str
    zone1: Optional[float] = None
    zone2: Optional[float] = None
    zone3: Optional[float] = None
    total_power: Optional[float] = None


class HistoryResponse(BaseModel):
    granularity: Literal["hourly", "daily"]
    zone: str
    points: list[HistoryPoint]


class ForecastPoint(BaseModel):
    timestamp: str
    actual: Optional[float]
    p10: Optional[float]
    p50: Optional[float]
    p90: Optional[float]
    capacity: Optional[float]
    risk_level: RiskLevel


class ForecastResponse(BaseModel):
    points: list[ForecastPoint]


class PeakWindow(BaseModel):
    timestamp: str
    forecast_mw: Optional[float]
    p90_mw: Optional[float]
    capacity_mw: float
    risk_level: RiskLevel
    breach: bool


class PeakWindowsResponse(BaseModel):
    windows: list[PeakWindow]


class CapacityScenario(BaseModel):
    reserve_margin: float
    forecast_peak_mw: float
    required_capacity_mw: float
    current_capacity_mw: float
    additional_capacity_required_mw: float


class CapacityScenariosResponse(BaseModel):
    current_capacity_mw: float
    scenarios: list[CapacityScenario]


class ModelEvaluation(BaseModel):
    model: str
    MAE: float
    RMSE: float
    WAPE: float
    peak_magnitude_error: Optional[float] = None
    peak_magnitude_error_pct: Optional[float] = None
    peak_timing_error_hours: Optional[float] = None
    actual_peak: Optional[float] = None
    predicted_peak: Optional[float] = None
    pinball_loss: Optional[float] = None
    pinball_loss_p10: Optional[float] = None
    pinball_loss_p50: Optional[float] = None
    pinball_loss_p90: Optional[float] = None
    coverage: Optional[float] = None
    average_interval_width: Optional[float] = None


class ModelMetricsResponse(BaseModel):
    capacity_threshold: float
    capacity_quantile: float
    test_window: dict
    target_coverage: float
    models: list[ModelEvaluation]


class HourlyProfilePoint(BaseModel):
    hour: int
    avg_load_mw: float
    p10_mw: float
    p90_mw: float


class HourlyProfileResponse(BaseModel):
    points: list[HourlyProfilePoint]


class WeekdayWeekendPoint(BaseModel):
    hour: int
    weekday_mw: Optional[float]
    weekend_mw: Optional[float]


class WeekdayWeekendResponse(BaseModel):
    points: list[WeekdayWeekendPoint]


class ZoneContributionPoint(BaseModel):
    hour: int
    zone1_mw: float
    zone2_mw: float
    zone3_mw: float


class ZoneContributionResponse(BaseModel):
    points: list[ZoneContributionPoint]


class MonthlyDistributionPoint(BaseModel):
    month: int
    min_mw: float
    q1_mw: float
    median_mw: float
    q3_mw: float
    max_mw: float
    outliers_mw: list[Optional[float]]


class MonthlyDistributionResponse(BaseModel):
    points: list[MonthlyDistributionPoint]


class WeatherSample(BaseModel):
    timestamp: str
    temperature: float
    humidity: float
    wind_speed: float
    total_power: float


class WeatherResponse(BaseModel):
    points: list[WeatherSample]


class DataQualityResponse(BaseModel):
    raw_rows: int
    raw_frequency: str
    raw_start: str
    raw_end: str
    hourly_rows: int
    hourly_start: str
    hourly_end: str
    aggregation: str
    total_power_definition: str
    units: str
    missing_timestamps: int
    null_values: int
    generated_at: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    datasets_loaded: dict[str, bool]
    data_start: Optional[str] = None
    data_end: Optional[str] = None
