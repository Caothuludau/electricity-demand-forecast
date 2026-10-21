"""Raw history, hourly series, and the EDA aggregates from notebook section 6."""

from __future__ import annotations

import pandas as pd

from app.core.paths import OBSERVATIONS_PATH, feature_pipeline, raw_csv

_CACHE: dict = {}

EXPORT_COLUMNS = {
    "datetime": "DateTime",
    "temperature": "Temperature",
    "humidity": "Humidity",
    "wind_speed": "Wind Speed",
    "general_diffuse_flows": "general diffuse flows",
    "diffuse_flows": "diffuse flows",
    "zone_1_power": "Zone 1 Power Consumption",
    "zone_2_power": "Zone 2  Power Consumption",
    "zone_3_power": "Zone 3  Power Consumption",
}


def _cache_key() -> tuple:
    raw_path = raw_csv()
    imported_mtime = OBSERVATIONS_PATH.stat().st_mtime if OBSERVATIONS_PATH.exists() else 0
    return (str(raw_path), raw_path.stat().st_mtime, imported_mtime)


def load_bundle() -> dict[str, pd.DataFrame]:
    key = _cache_key()
    if _CACHE.get("key") == key:
        return _CACHE["value"]

    pipeline = feature_pipeline()
    base = pipeline._core_frame(pd.read_csv(raw_csv()))
    if OBSERVATIONS_PATH.exists():
        imported = pipeline._core_frame(pd.read_csv(OBSERVATIONS_PATH))
        raw = (
            pd.concat([base, imported], ignore_index=True)
            .drop_duplicates("datetime", keep="last")
            .sort_values("datetime")
            .reset_index(drop=True)
        )
    else:
        imported = base.iloc[0:0].copy()
        raw = base

    hourly = pipeline.aggregate_hourly(raw).reset_index()
    bundle = {"raw": raw, "imported": imported, "hourly": hourly}
    _CACHE["key"] = key
    _CACHE["value"] = bundle
    return bundle


def clear_cache() -> None:
    _CACHE.clear()


def quality_report(raw: pd.DataFrame) -> dict:
    time_diff = raw["datetime"].diff().dropna()
    return {
        "rows": int(len(raw)),
        "start": pd.Timestamp(raw["datetime"].min()).isoformat(),
        "end": pd.Timestamp(raw["datetime"].max()).isoformat(),
        "duplicate_timestamps": int(raw["datetime"].duplicated().sum()),
        "missing_values": int(raw.isna().sum().sum()),
        "irregular_intervals": int((time_diff != pd.Timedelta(minutes=10)).sum()),
        "negative_power": int((raw[["zone_1_power", "zone_2_power", "zone_3_power"]] < 0).sum().sum()),
        "invalid_humidity": int((~raw["humidity"].between(0, 100)).sum()),
    }


def raw_page(limit: int, offset: int) -> dict:
    raw = load_bundle()["raw"]
    window = raw.iloc[offset : offset + limit]
    preview = raw.tail(144)
    return {
        "quality": quality_report(raw),
        "total_rows": int(len(raw)),
        "offset": offset,
        "rows": [_raw_row(row) for _, row in window.iterrows()],
        "preview": [_preview_point(row) for _, row in preview.iterrows()],
    }


def _raw_row(row: pd.Series) -> dict:
    return {
        "datetime": pd.Timestamp(row["datetime"]).isoformat(),
        "temperature": float(row["temperature"]),
        "humidity": float(row["humidity"]),
        "wind_speed": float(row["wind_speed"]),
        "general_diffuse_flows": float(row["general_diffuse_flows"]),
        "diffuse_flows": float(row["diffuse_flows"]),
        "zone_1_power": float(row["zone_1_power"]),
        "zone_2_power": float(row["zone_2_power"]),
        "zone_3_power": float(row["zone_3_power"]),
    }


def _preview_point(row: pd.Series) -> dict:
    total = float(row["zone_1_power"] + row["zone_2_power"] + row["zone_3_power"])
    return {"datetime": pd.Timestamp(row["datetime"]).isoformat(), "total_power": total}


def processed_view() -> dict:
    hourly = load_bundle()["hourly"]
    daily = (
        hourly.set_index("datetime")[["total_power", "zone_1_power", "zone_2_power", "zone_3_power"]]
        .resample("D")
        .mean()
        .dropna(how="all")
        .reset_index()
    )
    recent = hourly.tail(72)
    return {
        "rows": int(len(hourly)),
        "start": pd.Timestamp(hourly["datetime"].min()).isoformat(),
        "end": pd.Timestamp(hourly["datetime"].max()).isoformat(),
        "daily": [_hourly_point(row) for _, row in daily.iterrows()],
        "recent_hourly": [_hourly_point(row) for _, row in recent.iterrows()],
    }


def _hourly_point(row: pd.Series) -> dict:
    return {
        "datetime": pd.Timestamp(row["datetime"]).isoformat(),
        "total_power": None if pd.isna(row["total_power"]) else float(row["total_power"]),
        "zone_1_power": None if pd.isna(row["zone_1_power"]) else float(row["zone_1_power"]),
        "zone_2_power": None if pd.isna(row["zone_2_power"]) else float(row["zone_2_power"]),
        "zone_3_power": None if pd.isna(row["zone_3_power"]) else float(row["zone_3_power"]),
    }


def eda_view() -> dict:
    hourly = load_bundle()["hourly"].set_index("datetime")
    frame = hourly.copy()
    frame["hour"] = frame.index.hour
    frame["day_of_week"] = frame.index.dayofweek
    frame["day_name"] = frame.index.day_name()
    frame["month"] = frame.index.month
    frame["is_weekend"] = frame["day_of_week"].isin([5, 6])

    profile = frame.groupby("hour")["total_power"].agg(["mean", "median"])
    weekend = frame.groupby(["is_weekend", "hour"])["total_power"].mean().unstack(0)
    monthly = frame.groupby("month")["total_power"]
    zone_means = frame[["zone_1_power", "zone_2_power", "zone_3_power"]].mean()
    zone_share = zone_means / zone_means.sum()
    p95 = float(frame["total_power"].quantile(0.95))
    peaks = frame[frame["total_power"] > p95]
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    heat = (
        frame.pivot_table(index="day_name", columns="hour", values="total_power", aggfunc="mean")
        .reindex(day_order)
    )
    corr_cols = [
        "temperature",
        "humidity",
        "wind_speed",
        "general_diffuse_flows",
        "diffuse_flows",
        "zone_1_power",
        "zone_2_power",
        "zone_3_power",
        "total_power",
    ]
    correlation = frame[corr_cols].corr()
    scatter = frame[["temperature", "humidity", "total_power"]].sample(
        n=min(400, len(frame)), random_state=7
    )

    return {
        "timeline": [
            {"datetime": pd.Timestamp(ts).isoformat(), "total_power": float(value)}
            for ts, value in frame["total_power"].items()
        ],
        "hourly_profile": [
            {"hour": int(hour), "mean": float(row["mean"]), "median": float(row["median"])}
            for hour, row in profile.iterrows()
        ],
        "weekday_weekend": [
            {
                "hour": int(hour),
                "weekday": None if pd.isna(row.get(False)) else float(row[False]),
                "weekend": None if pd.isna(row.get(True)) else float(row[True]),
            }
            for hour, row in weekend.iterrows()
        ],
        "monthly_mean": [
            {"month": int(month), "mean": float(value)} for month, value in monthly.mean().items()
        ],
        "monthly_box": [
            {
                "month": int(month),
                "min": float(values.min()),
                "q1": float(values.quantile(0.25)),
                "median": float(values.median()),
                "q3": float(values.quantile(0.75)),
                "max": float(values.max()),
            }
            for month, values in monthly
        ],
        "zones": [
            {"zone": name, "mean": float(zone_means[name]), "share": float(zone_share[name])}
            for name in zone_means.index
        ],
        "p95": p95,
        "peak_by_hour": [
            {"hour": int(hour), "count": int(count)}
            for hour, count in peaks.groupby("hour").size().reindex(range(24), fill_value=0).items()
        ],
        "peak_by_month": [
            {"month": int(month), "count": int(count)}
            for month, count in peaks.groupby("month").size().reindex(range(1, 13), fill_value=0).items()
        ],
        "day_hour": {
            "days": day_order,
            "hours": list(range(24)),
            "values": [
                [None if pd.isna(value) else float(value) for value in row]
                for row in heat.round(1).values
            ],
        },
        "correlation": {
            "labels": corr_cols,
            "values": [
                [float(value) for value in row] for row in correlation.round(2).values
            ],
        },
        "scatter": [
            {
                "temperature": float(row.temperature),
                "humidity": float(row.humidity),
                "total_power": float(row.total_power),
            }
            for row in scatter.itertuples(index=False)
        ],
    }
