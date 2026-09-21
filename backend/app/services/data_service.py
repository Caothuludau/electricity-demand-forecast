"""Data access layer: loads processed parquet files once, serves filtered views.

All heavy forecasting is done offline by scripts/run_forecast.py; this service
only reads, filters and aggregates.
"""
from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd

from app.core.config import (
    DAILY_PARQUET,
    FORECAST_PARQUET,
    HOUR_PARQUET,
    MODEL_METRICS_JSON,
    MODELS_DIR,
)


@lru_cache(maxsize=1)
def hourly_load() -> pd.DataFrame:
    df = pd.read_parquet(HOUR_PARQUET)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True)


@lru_cache(maxsize=1)
def forecast() -> pd.DataFrame:
    df = pd.read_parquet(FORECAST_PARQUET)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True)


@lru_cache(maxsize=1)
def daily_metrics() -> pd.DataFrame:
    df = pd.read_parquet(DAILY_PARQUET)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True)


@lru_cache(maxsize=1)
def model_metrics() -> dict:
    return json.loads(MODEL_METRICS_JSON.read_text())


@lru_cache(maxsize=1)
def model_metadata() -> dict:
    path = MODELS_DIR / "model_metadata.json"
    if path.exists():
        return json.loads(path.read_text())
    return {}


def data_range() -> tuple[pd.Timestamp, pd.Timestamp]:
    df = hourly_load()
    return df["timestamp"].min(), df["timestamp"].max()
