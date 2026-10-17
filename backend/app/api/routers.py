"""API routers."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.core.config import (
    PROCESSED_DIR,
    SUPPORTED_GRANULARITY,
    SUPPORTED_ZONES,
)
from app.core.units import kw_to_mw
from app.schemas import schemas as s
from app.services import analytics_service as analytics
from app.services import data_service as ds


def _parse_dt(value: str | None, param: str) -> pd.Timestamp | None:
    if value is None:
        return None
    try:
        ts = pd.Timestamp(value)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {param}: {value}") from exc
    # normalize to tz-naive so comparisons with stored naive timestamps work
    if ts.tzinfo is not None:
        ts = ts.tz_convert("UTC").tz_localize(None)
    return ts


router = APIRouter(prefix="/api")


# --------------------------------------------------------------------------
# Dashboard overview
# --------------------------------------------------------------------------
@router.get("/dashboard/overview", response_model=s.OverviewResponse)
def overview() -> s.OverviewResponse:
    return s.OverviewResponse(**analytics.get_overview())


# --------------------------------------------------------------------------
# Historical load
# --------------------------------------------------------------------------
@router.get("/load/history", response_model=s.HistoryResponse)
def load_history(
    start: str | None = Query(None, description="ISO datetime"),
    end: str | None = Query(None, description="ISO datetime"),
    granularity: str = Query("hourly", description="hourly | daily"),
    zone: str = Query("total", description="total | zone1 | zone2 | zone3"),
) -> s.HistoryResponse:
    if granularity not in SUPPORTED_GRANULARITY:
        raise HTTPException(422, f"granularity must be one of {SUPPORTED_GRANULARITY}")
    if zone not in SUPPORTED_ZONES:
        raise HTTPException(422, f"zone must be one of {SUPPORTED_ZONES}")

    lo, hi = ds.data_range()
    start_ts = _parse_dt(start, "start") or lo
    end_ts = _parse_dt(end, "end") or hi
    if start_ts > end_ts:
        raise HTTPException(422, "start must be before end")

    if granularity == "daily":
        df = ds.daily_metrics().rename(columns={
            "zone1_mean": "zone1", "zone2_mean": "zone2", "zone3_mean": "zone3",
            "total_mean": "total_power",
        })
        if zone == "total":
            cols = ["timestamp", "zone1", "zone2", "zone3", "total_power"]
        else:
            cols = ["timestamp", "total_power", zone]
        out = df[(df["timestamp"] >= start_ts) & (df["timestamp"] <= end_ts)][cols]
    else:
        hourly = ds.hourly_load()
        if zone == "total":
            cols = ["timestamp", "zone1", "zone2", "zone3", "total_power"]
        else:
            cols = ["timestamp", "total_power", zone]
        out = hourly[(hourly["timestamp"] >= start_ts) & (hourly["timestamp"] <= end_ts)][cols]

    points = [
        s.HistoryPoint(
            timestamp=pd.Timestamp(r["timestamp"]).isoformat(),
            zone1=kw_to_mw(float(r["zone1"])) if "zone1" in r and pd.notna(r["zone1"]) else None,
            zone2=kw_to_mw(float(r["zone2"])) if "zone2" in r and pd.notna(r["zone2"]) else None,
            zone3=kw_to_mw(float(r["zone3"])) if "zone3" in r and pd.notna(r["zone3"]) else None,
            total_power=kw_to_mw(float(r["total_power"])) if pd.notna(r["total_power"]) else None,
        )
        for _, r in out.iterrows()
    ]
    return s.HistoryResponse(granularity=granularity, zone=zone, points=points)


# --------------------------------------------------------------------------
# Forecast
# --------------------------------------------------------------------------
@router.get("/forecast", response_model=s.ForecastResponse)
def get_forecast(
    start: str | None = Query(None),
    end: str | None = Query(None),
) -> s.ForecastResponse:
    fc = ds.forecast()
    lo, hi = fc["timestamp"].min(), fc["timestamp"].max()
    start_ts = _parse_dt(start, "start") or (hi - pd.Timedelta(days=7))
    end_ts = _parse_dt(end, "end") or hi
    if start_ts > end_ts:
        raise HTTPException(422, "start must be before end")

    out = fc[(fc["timestamp"] >= start_ts) & (fc["timestamp"] <= end_ts)]
    points = [
        s.ForecastPoint(
            timestamp=pd.Timestamp(r["timestamp"]).isoformat(),
            actual=kw_to_mw(float(r["actual"])) if pd.notna(r["actual"]) else None,
            p10=kw_to_mw(float(r["p10"])) if pd.notna(r["p10"]) else None,
            p50=kw_to_mw(float(r["p50"])) if pd.notna(r["p50"]) else None,
            p90=kw_to_mw(float(r["p90"])) if pd.notna(r["p90"]) else None,
            capacity=kw_to_mw(float(r["capacity"])) if pd.notna(r["capacity"]) else None,
            risk_level=str(r["risk_level"]),
        )
        for _, r in out.iterrows()
    ]
    return s.ForecastResponse(points=points)


# --------------------------------------------------------------------------
# Peak risk
# --------------------------------------------------------------------------
@router.get("/risk/peak-windows", response_model=s.PeakWindowsResponse)
def peak_windows(limit: int = Query(12, ge=1, le=50)) -> s.PeakWindowsResponse:
    return s.PeakWindowsResponse(windows=analytics.peak_windows(limit))


# --------------------------------------------------------------------------
# Capacity planning
# --------------------------------------------------------------------------
@router.get("/capacity/scenarios", response_model=s.CapacityScenariosResponse)
def capacity_scenarios() -> s.CapacityScenariosResponse:
    return s.CapacityScenariosResponse(**analytics.capacity_scenarios())


# --------------------------------------------------------------------------
# Model metrics
# --------------------------------------------------------------------------
@router.get("/model/metrics", response_model=s.ModelMetricsResponse)
def model_metrics() -> s.ModelMetricsResponse:
    raw = ds.model_metrics()
    # pipeline metrics are computed in the raw unit (kW-scale); convert
    # error-scale fields to MW so every load-related number shares one unit.
    watt_scale_fields = {
        "MAE", "RMSE", "peak_magnitude_error", "actual_peak", "predicted_peak",
        "pinball_loss", "pinball_loss_p10", "pinball_loss_p50", "pinball_loss_p90",
        "average_interval_width",
    }
    models = []
    for m in raw["models"].values():
        converted = {
            k: (kw_to_mw(v) if k in watt_scale_fields and v is not None else v)
            for k, v in m.items()
        }
        models.append(s.ModelEvaluation(**converted))
    return s.ModelMetricsResponse(
        capacity_threshold=kw_to_mw(raw["capacity_threshold"]),
        capacity_quantile=raw["capacity_quantile"],
        test_window=raw["test_window"],
        target_coverage=raw["target_coverage"],
        models=models,
    )


# --------------------------------------------------------------------------
# Load patterns
# --------------------------------------------------------------------------
@router.get("/load/hourly-profile", response_model=s.HourlyProfileResponse)
def hourly_profile() -> s.HourlyProfileResponse:
    return s.HourlyProfileResponse(points=analytics.hourly_profile())


@router.get("/load/weekday-weekend", response_model=s.WeekdayWeekendResponse)
def weekday_weekend() -> s.WeekdayWeekendResponse:
    return s.WeekdayWeekendResponse(points=analytics.weekday_weekend_profile())


@router.get("/load/zones", response_model=s.ZoneContributionResponse)
def zones() -> s.ZoneContributionResponse:
    return s.ZoneContributionResponse(points=analytics.zone_contribution())


@router.get("/load/monthly-distribution", response_model=s.MonthlyDistributionResponse)
def monthly_distribution() -> s.MonthlyDistributionResponse:
    return s.MonthlyDistributionResponse(points=analytics.monthly_distribution())


# --------------------------------------------------------------------------
# Data & Drivers page
# --------------------------------------------------------------------------
@router.get("/drivers/weather", response_model=s.WeatherResponse)
def weather_samples(
    limit: int = Query(3000, ge=100, le=8736),
) -> s.WeatherResponse:
    hourly = ds.hourly_load()
    out = hourly.tail(limit)
    points = [
        s.WeatherSample(
            timestamp=pd.Timestamp(r["timestamp"]).isoformat(),
            temperature=float(r["temperature"]),
            humidity=float(r["humidity"]),
            wind_speed=float(r["wind_speed"]),
            total_power=kw_to_mw(float(r["total_power"])),
        )
        for _, r in out.iterrows()
    ]
    return s.WeatherResponse(points=points)


@router.get("/data/quality", response_model=s.DataQualityResponse)
def data_quality() -> s.DataQualityResponse:
    meta_path = PROCESSED_DIR / "dataset_metadata.json"
    if not meta_path.exists():
        raise HTTPException(404, "dataset metadata not found; run the processing pipeline")
    meta = json.loads(meta_path.read_text())
    hourly = ds.hourly_load()
    expected = pd.date_range(hourly["timestamp"].min(), hourly["timestamp"].max(), freq="1h")
    missing = int(len(expected) - hourly["timestamp"].nunique())
    null_count = int(hourly.isna().sum().sum())
    return s.DataQualityResponse(
        raw_rows=meta["raw_rows"],
        raw_frequency=meta["raw_frequency"],
        raw_start=meta["raw_start"],
        raw_end=meta["raw_end"],
        hourly_rows=meta["hourly_rows"],
        hourly_start=meta["hourly_start"],
        hourly_end=meta["hourly_end"],
        aggregation=meta["aggregation"],
        total_power_definition=meta["total_power_definition"],
        units=meta["units"],
        missing_timestamps=missing,
        null_values=null_count,
        generated_at=meta["generated_at"],
    )


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@router.get("/health", response_model=s.HealthResponse)
def health() -> s.HealthResponse:
    loaded = {
        "hourly_load": False,
        "forecast": False,
        "daily_metrics": False,
        "model_metrics": False,
    }
    try:
        ds.hourly_load()
        loaded["hourly_load"] = True
    except Exception:
        pass
    try:
        ds.forecast()
        loaded["forecast"] = True
    except Exception:
        pass
    try:
        ds.daily_metrics()
        loaded["daily_metrics"] = True
    except Exception:
        pass
    try:
        ds.model_metrics()
        loaded["model_metrics"] = True
    except Exception:
        pass

    start = end = None
    if loaded["hourly_load"]:
        lo, hi = ds.data_range()
        start, end = lo.isoformat(), hi.isoformat()

    return s.HealthResponse(
        status="ok" if all(loaded.values()) else "degraded",
        datasets_loaded=loaded,
        data_start=start,
        data_end=end,
    )
