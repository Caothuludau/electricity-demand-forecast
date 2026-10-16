"""Turn raw 10-minute Tetouan readings into the 1-hour forecast frame.

The steps match sections 3, 4, 5, and 7 of
Tetouan_Forecasting_Full_Pipeline_VI.ipynb: standardize names, check the
10-minute series, average each hour, then build calendar, lag, rolling,
change, and weather-lag features. Nothing at t+1 enters a predictor.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

ZONE_COLS = ["zone_1_power", "zone_2_power", "zone_3_power"]
WEATHER_COLS = [
    "temperature",
    "humidity",
    "wind_speed",
    "general_diffuse_flows",
    "diffuse_flows",
]
REQUIRED_COLUMNS = {
    "datetime",
    "temperature",
    "humidity",
    "wind_speed",
    "general_diffuse_flows",
    "diffuse_flows",
    "zone_1_power",
    "zone_2_power",
    "zone_3_power",
}
LOAD_LAGS = [1, 2, 3, 6, 24, 48, 72, 168]
ROLLING_WINDOWS = [3, 6, 24, 168]


def standardize_raw(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Section 3: column names, timestamps, and numeric types."""
    df = df_raw.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(r"[^a-z0-9]+", "_", regex=True)
        .str.strip("_")
    )
    df = df.rename(
        columns={
            "zone_1_power_consumption": "zone_1_power",
            "zone_2_power_consumption": "zone_2_power",
            "zone_3_power_consumption": "zone_3_power",
        }
    )

    missing_columns = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    df["datetime"] = pd.to_datetime(df["datetime"], format="%m/%d/%Y %H:%M", errors="raise")
    df = df.sort_values("datetime").reset_index(drop=True)

    for col in WEATHER_COLS + ZONE_COLS:
        df[col] = pd.to_numeric(df[col], errors="raise")
    return df


def validate_10min(df: pd.DataFrame) -> None:
    """Section 4: duplicates, gaps, missing values, power, and humidity."""
    duplicate_timestamps = int(df["datetime"].duplicated().sum())
    missing_count = int(df[list(REQUIRED_COLUMNS)].isna().sum().sum())
    time_diff = df["datetime"].diff().dropna()
    irregular_intervals = int((time_diff != pd.Timedelta(minutes=10)).sum())
    negative_power = int((df[ZONE_COLS] < 0).sum().sum())
    invalid_humidity = int((~df["humidity"].between(0, 100)).sum())

    if duplicate_timestamps:
        raise ValueError("Duplicate timestamp detected")
    if missing_count:
        raise ValueError("Missing values detected")
    if irregular_intervals:
        raise ValueError("Intermittent time series according to step 10 min")
    if negative_power:
        raise ValueError("Negative power consumption detected")
    if invalid_humidity:
        raise ValueError("Humidity is outside the 0–100 range")


def aggregate_hourly(df: pd.DataFrame) -> pd.DataFrame:
    """Section 5: mean of the six 10-minute observations in each hour."""
    df = df.copy()
    df["total_power"] = df[ZONE_COLS].sum(axis=1)

    observations_per_hour = df.set_index("datetime")["total_power"].resample("h").size()
    if not (observations_per_hour == 6).all():
        raise ValueError("Not enough time right 6 observations")

    hourly_mean_cols = WEATHER_COLS + ZONE_COLS + ["total_power"]
    df_hourly = df.set_index("datetime")[hourly_mean_cols].resample("h").mean()
    df_hourly["observations_per_hour"] = observations_per_hour
    df_hourly.index.name = "datetime"

    expected_hourly_index = pd.date_range(df_hourly.index.min(), df_hourly.index.max(), freq="h")
    missing_hours = expected_hourly_index.difference(df_hourly.index)
    if len(missing_hours):
        raise ValueError("Timestamp missing hourly string")
    if int(df_hourly.isna().sum().sum()):
        raise ValueError("Hourly data is missing values")
    return df_hourly


def build_model_frame(
    df_hourly: pd.DataFrame, require_target: bool = True
) -> tuple[pd.DataFrame, list[str]]:
    """Section 7: features known at origin t, target is load at t+1."""
    df_fe = df_hourly.copy()
    df_fe["forecast_time"] = df_fe.index + pd.Timedelta(hours=1)
    df_fe["target_t_plus_1"] = df_fe["total_power"].shift(-1)

    forecast_dt = df_fe["forecast_time"]
    df_fe["forecast_hour"] = forecast_dt.dt.hour
    df_fe["forecast_day_of_week"] = forecast_dt.dt.dayofweek
    df_fe["forecast_day_of_month"] = forecast_dt.dt.day
    df_fe["forecast_day_of_year"] = forecast_dt.dt.dayofyear
    df_fe["forecast_week_of_year"] = forecast_dt.dt.isocalendar().week.astype(int)
    df_fe["forecast_month"] = forecast_dt.dt.month
    df_fe["forecast_quarter"] = forecast_dt.dt.quarter
    df_fe["forecast_is_weekend"] = forecast_dt.dt.dayofweek.isin([5, 6]).astype(int)

    df_fe["forecast_hour_sin"] = np.sin(2 * np.pi * df_fe["forecast_hour"] / 24)
    df_fe["forecast_hour_cos"] = np.cos(2 * np.pi * df_fe["forecast_hour"] / 24)
    df_fe["forecast_dow_sin"] = np.sin(2 * np.pi * df_fe["forecast_day_of_week"] / 7)
    df_fe["forecast_dow_cos"] = np.cos(2 * np.pi * df_fe["forecast_day_of_week"] / 7)
    df_fe["forecast_month_sin"] = np.sin(2 * np.pi * (df_fe["forecast_month"] - 1) / 12)
    df_fe["forecast_month_cos"] = np.cos(2 * np.pi * (df_fe["forecast_month"] - 1) / 12)

    calendar_features = [
        "forecast_hour",
        "forecast_day_of_week",
        "forecast_day_of_month",
        "forecast_day_of_year",
        "forecast_week_of_year",
        "forecast_month",
        "forecast_quarter",
        "forecast_is_weekend",
        "forecast_hour_sin",
        "forecast_hour_cos",
        "forecast_dow_sin",
        "forecast_dow_cos",
        "forecast_month_sin",
        "forecast_month_cos",
    ]

    load_lag_features = []
    for lag in LOAD_LAGS:
        col = f"total_power_lag_{lag}"
        df_fe[col] = df_fe["total_power"].shift(lag)
        load_lag_features.append(col)

    rolling_features = []
    for window in ROLLING_WINDOWS:
        mean_col = f"total_power_roll_mean_{window}h"
        std_col = f"total_power_roll_std_{window}h"
        df_fe[mean_col] = df_fe["total_power"].rolling(window).mean()
        df_fe[std_col] = df_fe["total_power"].rolling(window).std()
        rolling_features.extend([mean_col, std_col])

    df_fe["total_power_roll_min_24h"] = df_fe["total_power"].rolling(24).min()
    df_fe["total_power_roll_max_24h"] = df_fe["total_power"].rolling(24).max()
    rolling_features += ["total_power_roll_min_24h", "total_power_roll_max_24h"]

    df_fe["load_change_1h"] = df_fe["total_power"].diff(1)
    df_fe["load_change_24h"] = df_fe["total_power"] - df_fe["total_power"].shift(24)
    df_fe["load_change_168h"] = df_fe["total_power"] - df_fe["total_power"].shift(168)
    change_features = ["load_change_1h", "load_change_24h", "load_change_168h"]

    weather_lag_features = []
    for weather_col in WEATHER_COLS:
        for lag in [1, 24]:
            col = f"{weather_col}_lag_{lag}"
            df_fe[col] = df_fe[weather_col].shift(lag)
            weather_lag_features.append(col)

    current_features = ["total_power"] + ZONE_COLS + WEATHER_COLS
    feature_columns = (
        current_features
        + calendar_features
        + load_lag_features
        + rolling_features
        + change_features
        + weather_lag_features
    )
    model_columns = ["forecast_time"] + feature_columns + ["target_t_plus_1"]
    subset = model_columns if require_target else ["forecast_time"] + feature_columns
    df_model = df_fe[model_columns].dropna(subset=subset).copy()
    return df_model, feature_columns


def raw_to_model_frame(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Run sections 3–5 and 7 on one contiguous 10-minute history."""
    df = standardize_raw(df_raw)
    validate_10min(df)
    return build_model_frame(aggregate_hourly(df))


def forecast_frame_for_record(
    history_raw: pd.DataFrame, record_raw: pd.DataFrame
) -> tuple[pd.DataFrame, list[str]]:
    """Build the forecast row for one raw 10-minute record.

    The record uses the training-file schema. Lag and rolling features come from
    `history_raw` through the hour of that record. The next hour's load is
    returned as actual_target_t_plus_1 when the history contains it.
    """
    if len(record_raw) != 1:
        raise ValueError("Inference sample must be exactly one raw record")

    history = standardize_raw(history_raw)
    record = standardize_raw(record_raw)
    timestamp = record["datetime"].iloc[0]
    if (history["datetime"] == timestamp).any():
        series = history.loc[history["datetime"] <= timestamp].copy()
    else:
        series = pd.concat([history, record], ignore_index=True)
        series = series.sort_values("datetime").reset_index(drop=True)

    validate_10min(series)
    hourly = aggregate_hourly(series)
    origin = timestamp.floor("h")
    if origin not in hourly.index:
        raise ValueError(
            f"Hour {origin} is incomplete. A forecast origin needs six 10-minute readings."
        )

    model_df, feature_columns = build_model_frame(hourly, require_target=False)
    forecast_time = origin + pd.Timedelta(hours=1)
    row = model_df.loc[model_df["forecast_time"] == forecast_time].copy()
    if row.empty:
        raise ValueError("Not enough history before this record to build features")
    row = row.rename(columns={"target_t_plus_1": "actual_target_t_plus_1"})
    return row, feature_columns
