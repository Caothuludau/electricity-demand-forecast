"""Data processing: raw 10-minute Tetuan City CSV -> hourly analytical datasets.

Outputs (backend/data/processed/):
    hourly_load.parquet      hourly zones, total, weather
    weather_hourly.parquet   hourly weather (same grid, kept separate per spec)
    daily_metrics.parquet    daily aggregates for monthly distribution views

Aggregation rule (project spec): hourly demand = mean of the six 10-minute
observations within each hour; Total_Power = Zone1 + Zone2 + Zone3 computed
from the hourly means.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

# portable paths: host checkout has document/ as a sibling of backend/;
# in Docker the CSV is mounted at /app/document (inside the backend dir)
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_CSV_CANDIDATES = [
    _BACKEND_DIR.parent / "document" / "Tetuan City power consumption.csv",
    _BACKEND_DIR / "document" / "Tetuan City power consumption.csv",
]
RAW_PATH = next((p for p in _CSV_CANDIDATES if p.exists()), _CSV_CANDIDATES[0])
OUT_DIR = _BACKEND_DIR / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

COLUMN_MAP = {
    "DateTime": "timestamp",
    "Temperature": "temperature",
    "Humidity": "humidity",
    "Wind Speed": "wind_speed",
    "general diffuse flows": "general_diffuse_flows",
    "diffuse flows": "diffuse_flows",
    "Zone 1 Power Consumption": "zone1",
    "Zone 2  Power Consumption": "zone2",
    "Zone 3  Power Consumption": "zone3",
}


def load_raw() -> pd.DataFrame:
    df = pd.read_csv(RAW_PATH)
    df = df.rename(columns=COLUMN_MAP)
    df["timestamp"] = pd.to_datetime(df["timestamp"], format="%m/%d/%Y %H:%M")
    df = df.sort_values("timestamp").reset_index(drop=True)
    return df


def aggregate_hourly(df: pd.DataFrame) -> pd.DataFrame:
    df = df.set_index("timestamp")
    agg = df.resample("1h").mean()
    agg = agg.dropna(how="any")
    agg["total_power"] = agg["zone1"] + agg["zone2"] + agg["zone3"]
    agg = agg.reset_index()
    return agg


def main() -> None:
    raw = load_raw()
    print(f"raw 10-min rows: {len(raw)}  ({raw.timestamp.min()} -> {raw.timestamp.max()})")

    hourly = aggregate_hourly(raw)
    print(f"hourly rows: {len(hourly)}  ({hourly.timestamp.min()} -> {hourly.timestamp.max()})")

    hourly.to_parquet(OUT_DIR / "hourly_load.parquet", index=False)

    weather_cols = ["timestamp", "temperature", "humidity", "wind_speed",
                    "general_diffuse_flows", "diffuse_flows"]
    hourly[weather_cols].to_parquet(OUT_DIR / "weather_hourly.parquet", index=False)

    daily = hourly.set_index("timestamp").resample("1D").agg(
        total_mean=("total_power", "mean"),
        total_min=("total_power", "min"),
        total_max=("total_power", "max"),
        total_std=("total_power", "std"),
        zone1_mean=("zone1", "mean"),
        zone2_mean=("zone2", "mean"),
        zone3_mean=("zone3", "mean"),
        temperature_mean=("temperature", "mean"),
        humidity_mean=("humidity", "mean"),
    ).reset_index()
    daily.to_parquet(OUT_DIR / "daily_metrics.parquet", index=False)

    meta = {
        "source_file": RAW_PATH.name,
        "raw_frequency": "10min",
        "raw_rows": int(len(raw)),
        "raw_start": str(raw.timestamp.min()),
        "raw_end": str(raw.timestamp.max()),
        "hourly_start": str(hourly.timestamp.min()),
        "hourly_end": str(hourly.timestamp.max()),
        "hourly_rows": int(len(hourly)),
        "aggregation": "hourly mean of six 10-minute observations per zone",
        "total_power_definition": "zone1 + zone2 + zone3 (hourly means)",
        "units": "kW-scale readings (zone mean ~32,000); dashboard displays MW",
        "generated_at": pd.Timestamp.now().isoformat(),
    }
    import json
    (OUT_DIR / "dataset_metadata.json").write_text(json.dumps(meta, indent=2))
    print("datasets written to", OUT_DIR)


if __name__ == "__main__":
    main()
