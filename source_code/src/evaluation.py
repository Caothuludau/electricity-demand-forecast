"""Test metrics, peak-risk scores and figures for the Tetouan forecast."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from src.feature_engineering import (
    CALENDAR_FEATURES,
    INTERACTION_FEATURES,
    LAG_FEATURES,
    ROLL_FEATURES,
    TARGET,
    WEATHER_FEATURES,
)
from src.models import TrainedModel

sns.set_theme(style="whitegrid", context="paper")

GROUP_MAP = {
    "lag": LAG_FEATURES,
    "rolling": ROLL_FEATURES,
    "calendar": CALENDAR_FEATURES,
    "weather": WEATHER_FEATURES,
    "interaction": INTERACTION_FEATURES,
}


def regression_scores(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    error = y_pred - y_true
    mae = float(np.mean(np.abs(error)))
    rmse = float(np.sqrt(np.mean(error**2)))
    denom = float(np.sum(np.abs(y_true)))
    wape = float(np.sum(np.abs(error)) / denom * 100.0) if denom else float("nan")
    return {"mae_kw": mae, "rmse_kw": rmse, "wape_pct": wape}


def capacity_threshold(train: pd.DataFrame, quantile: float = 0.95) -> float:
    """Safety threshold: a high quantile of historical training demand."""
    return float(train[TARGET].quantile(quantile))


def peak_scores(test: pd.DataFrame, y_pred: np.ndarray, threshold: float) -> dict[str, float]:
    frame = test[["timestamp", TARGET]].copy()
    frame["y_pred"] = y_pred
    frame["hour"] = frame["timestamp"].dt.hour
    frame["day"] = frame["timestamp"].dt.floor("D")

    magnitude_errors: list[float] = []
    timing_errors: list[float] = []
    for _, day in frame.groupby("day"):
        if len(day) < 12:
            continue
        actual_idx = day[TARGET].idxmax()
        pred_idx = day["y_pred"].idxmax()
        magnitude_errors.append(abs(float(day.loc[pred_idx, "y_pred"] - day.loc[actual_idx, TARGET])))
        gap = abs(int(day.loc[actual_idx, "hour"]) - int(day.loc[pred_idx, "hour"]))
        timing_errors.append(float(min(gap, 24 - gap)))

    actual_breach = frame[TARGET].to_numpy() > threshold
    predicted_breach = frame["y_pred"].to_numpy() > threshold
    n_breach = int(actual_breach.sum())
    hits = int(np.sum(actual_breach & predicted_breach))
    alerts = int(predicted_breach.sum())
    return {
        "n_days": int(len(magnitude_errors)),
        "peak_magnitude_error_kw": float(np.mean(magnitude_errors)) if magnitude_errors else float("nan"),
        "peak_timing_error_h": float(np.mean(timing_errors)) if timing_errors else float("nan"),
        "n_breach_hours": n_breach,
        "breach_anticipation_rate_pct": float(100.0 * hits / n_breach) if n_breach else float("nan"),
        "alert_precision_pct": float(100.0 * hits / alerts) if alerts else float("nan"),
        "n_alerts": alerts,
    }


def _acf(series: pd.Series, max_lag: int = 168) -> list[float]:
    values = series.to_numpy(dtype=float)
    values = values - values.mean()
    denom = float(np.dot(values, values))
    return [1.0 if lag == 0 else float(np.dot(values[:-lag], values[lag:]) / denom) for lag in range(max_lag + 1)]


def dataset_profile(hourly: pd.DataFrame, featured: pd.DataFrame) -> dict:
    corr_columns = ["total_kw", "temperature", "humidity", "wind_speed", "general_diffuse_flows", "diffuse_flows"]
    corr = hourly[corr_columns].corr()
    by_hour = hourly.groupby(hourly["timestamp"].dt.hour)[TARGET].mean()
    weekend = hourly["timestamp"].dt.dayofweek >= 5
    weekday_profile = hourly.loc[~weekend].groupby(hourly.loc[~weekend, "timestamp"].dt.hour)[TARGET].mean()
    weekend_profile = hourly.loc[weekend].groupby(hourly.loc[weekend, "timestamp"].dt.hour)[TARGET].mean()
    monthly = hourly.groupby(hourly["timestamp"].dt.to_period("M"))[TARGET].mean()
    acf = _acf(hourly[TARGET])
    return {
        "hourly_rows": int(len(hourly)),
        "featured_rows": int(len(featured)),
        "rows_dropped_for_lags": int(featured.attrs.get("rows_dropped_for_lags", 0)),
        "start": hourly["timestamp"].min().isoformat(sep=" "),
        "end": hourly["timestamp"].max().isoformat(sep=" "),
        "mean_kw": float(hourly[TARGET].mean()),
        "std_kw": float(hourly[TARGET].std()),
        "min_kw": float(hourly[TARGET].min()),
        "max_kw": float(hourly[TARGET].max()),
        "zone_mean_kw": {zone: float(hourly[zone].mean()) for zone in ("zone1_kw", "zone2_kw", "zone3_kw")},
        "temperature_mean_c": float(hourly["temperature"].mean()),
        "temperature_min_c": float(hourly["temperature"].min()),
        "temperature_max_c": float(hourly["temperature"].max()),
        "corr_with_demand": {column: float(corr.loc["total_kw", column]) for column in corr_columns if column != "total_kw"},
        "mean_by_hour": {str(hour): float(value) for hour, value in by_hour.items()},
        "weekday_by_hour": {str(hour): float(value) for hour, value in weekday_profile.items()},
        "weekend_by_hour": {str(hour): float(value) for hour, value in weekend_profile.items()},
        "mean_by_month": {str(period): float(value) for period, value in monthly.items()},
        "peak_hour_mean": int(by_hour.idxmax()),
        "acf": {"1": acf[1], "2": acf[2], "24": acf[24], "168": acf[168]},
        "acf_full": acf,
        "correlation_matrix": corr.round(4).to_dict(),
    }


def breach_by_hour(frame: pd.DataFrame, threshold: float) -> dict[str, float]:
    hours = frame["timestamp"].dt.hour
    rates = {}
    for hour in range(24):
        mask = hours == hour
        rates[str(hour)] = float((frame.loc[mask, TARGET] > threshold).mean() * 100.0) if mask.any() else 0.0
    return rates


def grouped_importance(importance: dict[str, float]) -> dict[str, float]:
    grouped = {}
    for name, columns in GROUP_MAP.items():
        grouped[name] = float(sum(importance.get(column, 0.0) for column in columns))
    return grouped


def _save(fig: plt.Figure, folder: Path, name: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    fig.savefig(folder / name, dpi=160, bbox_inches="tight")
    plt.close(fig)


def save_figures(
    hourly: pd.DataFrame,
    test: pd.DataFrame,
    predictions: dict[str, np.ndarray],
    importance: dict[str, float],
    threshold: float,
    scores: dict[str, dict],
    profile: dict,
    folder: Path,
) -> None:
    folder.mkdir(parents=True, exist_ok=True)

    hours = np.arange(24)
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.plot(hours, [profile["weekday_by_hour"][str(h)] / 1000 for h in hours], label="Weekday", color="#1f4e79")
    ax.plot(hours, [profile["weekend_by_hour"][str(h)] / 1000 for h in hours], label="Weekend", color="#c47b2b")
    ax.set_xlabel("Hour of day")
    ax.set_ylabel("Mean demand (MW)")
    ax.set_xticks(range(0, 24, 2))
    ax.legend()
    ax.set_title("Average city demand by hour")
    _save(fig, folder, "daily_profile.png")

    sample = hourly[(hourly["timestamp"] >= "2017-07-03") & (hourly["timestamp"] < "2017-07-17")]
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.plot(sample["timestamp"], sample[TARGET] / 1000, color="#1f4e79", linewidth=1.0)
    ax.set_ylabel("Demand (MW)")
    ax.set_title("Two summer weeks of hourly demand")
    fig.autofmt_xdate()
    _save(fig, folder, "weekly_series.png")

    months = list(profile["mean_by_month"])
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.bar(range(len(months)), [profile["mean_by_month"][m] / 1000 for m in months], color="#1f4e79")
    ax.set_xticks(range(len(months)))
    ax.set_xticklabels([m[5:] for m in months])
    ax.set_ylabel("Mean demand (MW)")
    ax.set_xlabel("Month in 2017")
    ax.set_title("Seasonal level of hourly demand")
    _save(fig, folder, "monthly_mean.png")

    fig, ax = plt.subplots(figsize=(6.4, 4.0))
    plot_df = hourly.sample(n=min(2500, len(hourly)), random_state=42)
    ax.scatter(plot_df["temperature"], plot_df[TARGET] / 1000, s=8, alpha=0.35, color="#1f4e79")
    ax.set_xlabel("Temperature (°C)")
    ax.set_ylabel("Demand (MW)")
    ax.set_title("Temperature against city demand")
    _save(fig, folder, "temp_scatter.png")

    corr = pd.DataFrame(profile["correlation_matrix"])
    fig, ax = plt.subplots(figsize=(6.2, 5.0))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0, ax=ax, cbar_kws={"shrink": 0.8})
    ax.set_title("Correlation of demand and weather")
    _save(fig, folder, "correlation_heatmap.png")

    acf = profile["acf_full"]
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.bar(range(len(acf)), acf, width=1.0, color="#1f4e79")
    ax.set_xlim(0, 168)
    ax.set_xlabel("Lag (hours)")
    ax.set_ylabel("Autocorrelation")
    ax.set_title("Autocorrelation of hourly demand")
    _save(fig, folder, "autocorrelation.png")

    best_name = min(scores, key=lambda name: scores[name]["mae_kw"])
    window = test[(test["timestamp"] >= test["timestamp"].min())].head(24 * 14)
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    ax.plot(window["timestamp"], window[TARGET] / 1000, label="Actual", color="#222222", linewidth=1.1)
    ax.plot(window["timestamp"], predictions[best_name][: len(window)] / 1000, label=best_name, color="#c47b2b", linewidth=1.1)
    ax.axhline(threshold / 1000, color="#a33b3b", linestyle="--", linewidth=1.0, label="Capacity threshold")
    ax.set_ylabel("Demand (MW)")
    ax.set_title(f"First two test weeks: actual vs {best_name}")
    ax.legend(loc="upper right")
    fig.autofmt_xdate()
    _save(fig, folder, "forecast_test.png")

    order = list(scores)
    fig, ax = plt.subplots(figsize=(7.0, 3.6))
    xpos = np.arange(len(order))
    ax.bar(xpos - 0.18, [scores[name]["mae_kw"] / 1000 for name in order], width=0.36, label="MAE", color="#1f4e79")
    ax.bar(xpos + 0.18, [scores[name]["rmse_kw"] / 1000 for name in order], width=0.36, label="RMSE", color="#7f9bb5")
    ax.set_xticks(xpos)
    ax.set_xticklabels([name.replace("_", "\n") for name in order])
    ax.set_ylabel("Error (MW)")
    ax.set_title("Test error by model")
    ax.legend()
    _save(fig, folder, "model_comparison.png")

    if importance:
        ranked = sorted(importance.items(), key=lambda item: item[1], reverse=True)[:12]
        fig, ax = plt.subplots(figsize=(7.0, 4.2))
        labels = [name.replace("_", " ") for name, _ in ranked][::-1]
        values = [value * 100 for _, value in ranked][::-1]
        ax.barh(labels, values, color="#1f4e79")
        ax.set_xlabel("Share of LightGBM gain (%)")
        ax.set_title("Feature importance")
        _save(fig, folder, "feature_importance.png")

    rates = breach_by_hour(hourly, threshold)
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.bar(hours, [rates[str(h)] for h in hours], color="#a33b3b")
    ax.set_xlabel("Hour of day")
    ax.set_ylabel("Hours above threshold (%)")
    ax.set_xticks(range(0, 24, 2))
    ax.set_title("When demand exceeds the training 95th percentile")
    _save(fig, folder, "breach_by_hour.png")


def write_metrics(payload: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serializable = json.loads(json.dumps(payload, default=float))
    serializable.get("profile", {}).pop("acf_full", None)
    path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")
