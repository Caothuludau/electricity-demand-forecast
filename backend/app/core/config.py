"""Application configuration constants."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = BASE_DIR / "models"

HOUR_PARQUET = PROCESSED_DIR / "hourly_load.parquet"
WEATHER_PARQUET = PROCESSED_DIR / "weather_hourly.parquet"
FORECAST_PARQUET = PROCESSED_DIR / "forecast.parquet"
DAILY_PARQUET = PROCESSED_DIR / "daily_metrics.parquet"
MODEL_METRICS_JSON = PROCESSED_DIR / "model_metrics.json"

SUPPORTED_ZONES = ("total", "zone1", "zone2", "zone3")
SUPPORTED_GRANULARITY = ("hourly", "daily")
RESERVE_MARGINS = (0.10, 0.15, 0.20)

DAILY_PEAK_KW = 0.95  # quantile used for daily peak used in reserve planning
