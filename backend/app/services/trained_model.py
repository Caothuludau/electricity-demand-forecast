"""Load the notebook model and score imported 10-minute rows."""

from __future__ import annotations

import json
import pickle
from datetime import datetime, timezone

import pandas as pd

from app.core.paths import (
    FORECASTS_PATH,
    OBSERVATIONS_PATH,
    evaluation_json,
    feature_pipeline,
    model_pkl,
    raw_csv,
)
from app.services.catalog import EXPORT_COLUMNS, clear_cache, load_bundle

_MODEL: dict | None = None

FORECAST_COLUMNS = [
    "forecast_time",
    "pred_lightgbm",
    "pred_xgboost",
    "pred_ensemble",
    "pred_selected",
    "actual_target_t_plus_1",
    "imported_at",
]


def saved_model() -> dict:
    global _MODEL
    if _MODEL is None:
        with model_pkl().open("rb") as model_file:
            _MODEL = pickle.load(model_file)
    return _MODEL


def model_view() -> dict:
    saved = saved_model()
    evaluation = json.loads(evaluation_json().read_text())
    evaluation["selected_model"] = saved["selected_model"]
    evaluation["weight_lightgbm"] = float(saved["weight_lightgbm"])
    evaluation["weight_xgboost"] = float(saved["weight_xgboost"])
    evaluation["feature_columns"] = list(saved["feature_columns"])
    return evaluation


def stored_forecasts() -> list[dict]:
    if not FORECASTS_PATH.exists():
        return []
    frame = pd.read_csv(FORECASTS_PATH, parse_dates=["forecast_time"])
    return [_forecast_row(row) for _, row in frame.iterrows()]


def stored_observations() -> list[dict]:
    imported = load_bundle()["imported"]
    return [
        {
            "datetime": pd.Timestamp(row.datetime).isoformat(),
            "temperature": float(row.temperature),
            "humidity": float(row.humidity),
            "wind_speed": float(row.wind_speed),
            "zone_1_power": float(row.zone_1_power),
            "zone_2_power": float(row.zone_2_power),
            "zone_3_power": float(row.zone_3_power),
        }
        for row in imported.itertuples(index=False)
    ]


def import_observations(upload: pd.DataFrame) -> dict:
    pipeline = feature_pipeline()
    history = pd.read_csv(raw_csv())
    if OBSERVATIONS_PATH.exists():
        history = pd.concat([history, pd.read_csv(OBSERVATIONS_PATH)], ignore_index=True)

    scored, feature_columns = pipeline.forecast_new_observations(history, upload)
    saved = saved_model()
    if list(feature_columns) != list(saved["feature_columns"]):
        raise ValueError("Built features do not match the saved model")

    matrix = scored[feature_columns]
    scored["pred_lightgbm"] = saved["lightgbm"].predict(matrix)
    scored["pred_xgboost"] = saved["xgboost"].predict(matrix)
    scored["pred_ensemble"] = (
        saved["weight_lightgbm"] * scored["pred_lightgbm"]
        + saved["weight_xgboost"] * scored["pred_xgboost"]
    )
    selected = saved["selected_model"]
    pred_col = {"LightGBM": "pred_lightgbm", "XGBoost": "pred_xgboost", "Ensemble": "pred_ensemble"}[
        selected
    ]
    scored["pred_selected"] = scored[pred_col]
    scored["imported_at"] = datetime.now(timezone.utc).isoformat()

    incoming = pipeline._core_frame(upload)
    _append_observations(incoming)
    _append_forecasts(scored)
    clear_cache()
    return {
        "rows_imported": int(len(incoming)),
        "forecasts": [_forecast_row(row) for _, row in scored.iterrows()],
    }


def _append_observations(incoming: pd.DataFrame) -> None:
    OBSERVATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    exported = incoming.rename(columns=EXPORT_COLUMNS)
    exported["DateTime"] = pd.to_datetime(exported["DateTime"]).dt.strftime("%m/%d/%Y %H:%M")
    exported = exported[list(EXPORT_COLUMNS.values())]
    exported.to_csv(OBSERVATIONS_PATH, mode="a", header=not OBSERVATIONS_PATH.exists(), index=False)


def _append_forecasts(scored: pd.DataFrame) -> None:
    FORECASTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = scored[FORECAST_COLUMNS].copy()
    out["forecast_time"] = pd.to_datetime(out["forecast_time"]).dt.strftime("%Y-%m-%d %H:%M:%S")
    out.to_csv(FORECASTS_PATH, mode="a", header=not FORECASTS_PATH.exists(), index=False)


def _forecast_row(row: pd.Series) -> dict:
    actual = row["actual_target_t_plus_1"]
    return {
        "forecast_time": pd.Timestamp(row["forecast_time"]).isoformat(),
        "pred_lightgbm": float(row["pred_lightgbm"]),
        "pred_xgboost": float(row["pred_xgboost"]),
        "pred_ensemble": float(row["pred_ensemble"]),
        "pred_selected": float(row["pred_selected"]),
        "actual_target_t_plus_1": None if pd.isna(actual) else float(actual),
    }
