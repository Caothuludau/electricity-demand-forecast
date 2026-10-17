"""Lightweight analytics on top of the processed datasets."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.config import RESERVE_MARGINS
from app.core.risk import evaluate_risk
from app.core.units import kw_to_mw
from app.services import data_service


def capacity_threshold() -> float:
    return float(data_service.model_metrics()["capacity_threshold"])


def get_overview() -> dict:
    fc = data_service.forecast()
    hourly = data_service.hourly_load()
    capacity = capacity_threshold()

    last = fc.iloc[-1]
    last_actual = float(last["actual"])

    # next-hour forecast = P50 of the last row with a probabilistic forecast
    has_prob = fc["p50"].notna()
    if has_prob.any():
        next_fc_row = fc[has_prob].iloc[-1]
        p10, p50, p90 = (float(next_fc_row[c]) for c in ("p10", "p50", "p90"))
        next_ts = pd.Timestamp(next_fc_row["timestamp"])
    else:
        p10 = p50 = p90 = None
        next_ts = None

    risk = evaluate_risk(p50, p90, capacity, last_actual)

    # required capacity at 15% default reserve margin based on forecast peak
    reserve = 0.15
    base_peak = p50 if p50 is not None else last_actual
    required = base_peak * (1 + reserve)

    # next peak-risk window: first future/most-recent row where risk != low
    risk_rows = fc[fc["risk_level"].isin(("medium", "high"))]
    upcoming = risk_rows[risk_rows["timestamp"] > fc["timestamp"].iloc[-1] - pd.Timedelta(hours=1)]
    next_window = None
    if not upcoming.empty:
        row = upcoming.iloc[-1]
        next_window = {
            "timestamp": row["timestamp"].isoformat(),
            "risk_level": row["risk_level"],
        }

    return {
        "latest_timestamp": pd.Timestamp(last["timestamp"]).isoformat(),
        "current_load_mw": kw_to_mw(last_actual),
        "next_forecast_mw": kw_to_mw(p50),
        "next_forecast_timestamp": next_ts.isoformat() if next_ts is not None else None,
        "p10_mw": kw_to_mw(p10),
        "p90_mw": kw_to_mw(p90),
        "capacity_mw": kw_to_mw(capacity),
        "risk_level": risk,
        "reserve_margin": reserve,
        "required_capacity_mw": kw_to_mw(required),
        "next_risk_window": next_window,
        "data_start": fc["timestamp"].min().isoformat(),
        "data_end": fc["timestamp"].max().isoformat(),
        "forecast_available": bool(has_prob.any()),
    }


def filter_history(df: pd.DataFrame, start, end, column: str) -> pd.DataFrame:
    out = df[(df["timestamp"] >= start) & (df["timestamp"] <= end)]
    if column == "total":
        cols = ["timestamp", "zone1", "zone2", "zone3", "total_power"]
    else:
        cols = ["timestamp", "total_power", column]
    return out[cols]


def hourly_profile() -> list[dict]:
    hourly = data_service.hourly_load()
    h = hourly.assign(hour=hourly["timestamp"].dt.hour)
    grouped = h.groupby("hour")["total_power"]
    avg = grouped.mean()
    p10 = grouped.quantile(0.1)
    p90 = grouped.quantile(0.9)
    return [
        {
            "hour": int(hour),
            "avg_load_mw": kw_to_mw(float(avg[hour])),
            "p10_mw": kw_to_mw(float(p10[hour])),
            "p90_mw": kw_to_mw(float(p90[hour])),
        }
        for hour in range(24)
    ]


def weekday_weekend_profile() -> list[dict]:
    hourly = data_service.hourly_load()
    h = hourly.assign(
        hour=hourly["timestamp"].dt.hour,
        is_weekend=(hourly["timestamp"].dt.dayofweek >= 5),
    )
    grouped = h.groupby(["hour", "is_weekend"])["total_power"].mean().unstack()
    rows = []
    for hour in range(24):
        rows.append({
            "hour": int(hour),
            "weekday_mw": kw_to_mw(float(grouped.loc[hour, False])) if False in grouped.columns else None,
            "weekend_mw": kw_to_mw(float(grouped.loc[hour, True])) if True in grouped.columns else None,
        })
    return rows


def zone_contribution() -> list[dict]:
    hourly = data_service.hourly_load()
    h = hourly.assign(hour=hourly["timestamp"].dt.hour)
    grouped = h.groupby("hour")[["zone1", "zone2", "zone3"]].mean()
    return [
        {
            "hour": int(hour),
            "zone1_mw": kw_to_mw(float(grouped.loc[hour, "zone1"])),
            "zone2_mw": kw_to_mw(float(grouped.loc[hour, "zone2"])),
            "zone3_mw": kw_to_mw(float(grouped.loc[hour, "zone3"])),
        }
        for hour in range(24)
    ]


def monthly_distribution() -> list[dict]:
    hourly = data_service.hourly_load()
    h = hourly.assign(month=hourly["timestamp"].dt.month)
    rows = []
    for month in sorted(h["month"].unique()):
        vals = h.loc[h["month"] == month, "total_power"]
        q1, med, q3 = vals.quantile([0.25, 0.5, 0.75])
        lo_fence = q1 - 1.5 * (q3 - q1)
        hi_fence = q3 + 1.5 * (q3 - q1)
        inliers = vals[(vals >= lo_fence) & (vals <= hi_fence)]
        rows.append({
            "month": int(month),
            "min_mw": kw_to_mw(float(inliers.min())),
            "q1_mw": kw_to_mw(float(q1)),
            "median_mw": kw_to_mw(float(med)),
            "q3_mw": kw_to_mw(float(q3)),
            "max_mw": kw_to_mw(float(inliers.max())),
            "outliers_mw": [kw_to_mw(float(v)) for v in vals[(vals < lo_fence) | (vals > hi_fence)].head(50)],
        })
    return rows


def peak_windows(limit: int = 12) -> list[dict]:
    fc = data_service.forecast()
    capacity = capacity_threshold()
    risky = fc[fc["risk_level"].isin(("medium", "high"))].copy()
    # forecast-window hours (with P50/P90) first — they carry the full risk rule —
    # then the most recent actual-based breaches.
    has_prob = risky["p50"].notna()
    prioritized = pd.concat([
        risky[has_prob].sort_values("timestamp", ascending=False),
        risky[~has_prob].sort_values("timestamp", ascending=False),
    ]).head(limit)
    rows = []
    for _, r in prioritized.iterrows():
        rows.append({
            "timestamp": r["timestamp"].isoformat(),
            "forecast_mw": kw_to_mw(float(r["p50"])) if pd.notna(r["p50"]) else kw_to_mw(float(r["actual"])),
            "p90_mw": kw_to_mw(float(r["p90"])) if pd.notna(r["p90"]) else None,
            "capacity_mw": kw_to_mw(capacity),
            "risk_level": str(r["risk_level"]),
            "breach": bool(r["p50"] >= capacity) if pd.notna(r["p50"]) else bool(r["actual"] >= capacity),
        })
    return rows


def capacity_scenarios() -> dict:
    fc = data_service.forecast()
    capacity = capacity_threshold()
    # forecast peak = max P50 over the probabilistic (test) window
    prob = fc[fc["p50"].notna()]
    if prob.empty:
        forecast_peak = float(fc["actual"].max())
    else:
        forecast_peak = float(prob["p50"].max())

    scenarios = []
    for margin in RESERVE_MARGINS:
        required = forecast_peak * (1 + margin)
        scenarios.append({
            "reserve_margin": margin,
            "forecast_peak_mw": kw_to_mw(forecast_peak),
            "required_capacity_mw": kw_to_mw(required),
            "current_capacity_mw": kw_to_mw(capacity),
            "additional_capacity_required_mw": kw_to_mw(max(0.0, required - capacity)),
        })
    return {
        "current_capacity_mw": kw_to_mw(capacity),
        "scenarios": scenarios,
    }
