"""Calendar, lag, rolling and weather features for one-hour-ahead demand."""

from __future__ import annotations

import numpy as np
import pandas as pd

TARGET = "total_kw"
LAGS = (1, 2, 24, 168)
WINDOWS = (3, 6, 24)
# Comfort threshold used only to build a cooling-degree feature (degrees Celsius).
COOLING_BASE_C = 22.0

CALENDAR_FEATURES = ["hour", "day_of_week", "month", "is_weekend"]
LAG_FEATURES = [f"lag_{lag}" for lag in LAGS]
ROLL_FEATURES = [f"roll_mean_{window}" for window in WINDOWS] + [f"roll_std_{window}" for window in WINDOWS]
WEATHER_FEATURES = [
    "temperature",
    "humidity",
    "wind_speed",
    "general_diffuse_flows",
    "diffuse_flows",
]
INTERACTION_FEATURES = ["temp_x_hour", "cooling_degree", "temp_sq"]


def feature_columns() -> list[str]:
    return CALENDAR_FEATURES + LAG_FEATURES + ROLL_FEATURES + WEATHER_FEATURES + INTERACTION_FEATURES


def build_features(hourly: pd.DataFrame) -> pd.DataFrame:
    """Return a supervised table. Rolling statistics use only past hours."""
    frame = hourly.sort_values("timestamp").copy()
    stamp = frame["timestamp"]
    demand = frame[TARGET]

    frame["hour"] = stamp.dt.hour
    frame["day_of_week"] = stamp.dt.dayofweek
    frame["month"] = stamp.dt.month
    frame["is_weekend"] = (frame["day_of_week"] >= 5).astype(int)

    for lag in LAGS:
        frame[f"lag_{lag}"] = demand.shift(lag)

    # shift(1) keeps the current hour out of the window, so the target cannot leak in.
    past = demand.shift(1)
    for window in WINDOWS:
        frame[f"roll_mean_{window}"] = past.rolling(window, min_periods=window).mean()
        frame[f"roll_std_{window}"] = past.rolling(window, min_periods=window).std()

    frame["temp_x_hour"] = frame["temperature"] * frame["hour"]
    frame["cooling_degree"] = np.maximum(frame["temperature"] - COOLING_BASE_C, 0.0)
    frame["temp_sq"] = frame["temperature"] ** 2

    before = len(frame)
    frame = frame.dropna(subset=feature_columns() + [TARGET]).reset_index(drop=True)
    frame.attrs["rows_dropped_for_lags"] = before - len(frame)
    return frame


def temporal_split(
    frame: pd.DataFrame,
    train_ratio: float = 0.70,
    valid_ratio: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Contiguous, non-overlapping blocks in chronological order."""
    if train_ratio <= 0 or valid_ratio <= 0 or train_ratio + valid_ratio >= 1:
        raise ValueError("train_ratio and valid_ratio must leave a non-empty test block")
    n_rows = len(frame)
    train_end = int(n_rows * train_ratio)
    valid_end = int(n_rows * (train_ratio + valid_ratio))
    if min(train_end, valid_end - train_end, n_rows - valid_end) < 24:
        raise ValueError("Split produced a block shorter than one day")
    train = frame.iloc[:train_end].copy()
    valid = frame.iloc[train_end:valid_end].copy()
    test = frame.iloc[valid_end:].copy()
    return train, valid, test
