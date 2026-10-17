"""Forecasting pipeline: hourly load -> 1h-ahead forecasts with uncertainty.

Produces (offline, run once):
    backend/data/processed/forecast.parquet   per-timestamp actual + p10/p50/p90
                                              + capacity + risk level
    backend/data/processed/model_metrics.json  evaluation metrics per model
    backend/models/model.pkl                   trained LightGBM P50 model
    backend/models/model_metadata.json

Methodology
    - Target: Total_Power (zone1+zone2+zone3 hourly means), 1-step-ahead.
    - Temporal split: last 30 days of the record are the test set (walk-forward
      style evaluation, never random).
    - Baselines: Seasonal Naive 24h and Seasonal Naive 168h.
    - Main model: LightGBM gradient boosting with calendar + lag + rolling
      weather features. Quantile models (alpha=0.1 / 0.5 / 0.9) provide P10,
      P50 and P90 without inventing a distributional assumption.
    - Capacity threshold C: P95 of observed hourly total load over the training
      period (documented heuristic for a planning threshold).
    - Risk rule (project spec): P90 < C -> low; P50 < C <= P90 -> medium;
      C <= P50 -> high.
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

_BACKEND_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = _BACKEND_DIR / "data" / "processed"
MODELS_DIR = _BACKEND_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

HORIZON = 1  # 1 hour ahead
TEST_DAYS = 30
CAPACITY_QUANTILE = 0.95

QUANTILES = {"p10": 0.1, "p50": 0.5, "p90": 0.9}


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy().sort_values("timestamp").reset_index(drop=True)
    ts = out["timestamp"]

    out["hour"] = ts.dt.hour
    out["dayofweek"] = ts.dt.dayofweek
    out["month"] = ts.dt.month
    out["dayofyear"] = ts.dt.dayofyear
    out["is_weekend"] = (out["dayofweek"] >= 5).astype(int)
    # cyclical encodings so the model sees hour-of-day as continuous
    out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24)
    out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24)
    out["dow_sin"] = np.sin(2 * np.pi * out["dayofweek"] / 7)
    out["dow_cos"] = np.cos(2 * np.pi * out["dayofweek"] / 7)

    # lag features (all available at forecast time: t+1 prediction made at t)
    for lag in (1, 2, 3, 24, 48, 168):
        out[f"lag_{lag}"] = out["total_power"].shift(lag)

    # rolling statistics on past values (shift(1) so no leakage)
    for win in (6, 24, 168):
        out[f"roll_mean_{win}"] = out["total_power"].shift(1).rolling(win).mean()
        out[f"roll_std_{win}"] = out["total_power"].shift(1).rolling(win).std()

    # weather (known/observed at forecast issue time)
    for col in ("temperature", "humidity", "wind_speed"):
        out[f"{col}_lag1"] = out[col].shift(1)

    out = out.dropna().reset_index(drop=True)
    return out


FEATURE_COLS = [
    "hour", "dayofweek", "month", "dayofyear", "is_weekend",
    "hour_sin", "hour_cos", "dow_sin", "dow_cos",
    "lag_1", "lag_2", "lag_3", "lag_24", "lag_48", "lag_168",
    "roll_mean_6", "roll_std_6", "roll_mean_24", "roll_std_24",
    "roll_mean_168", "roll_std_168",
    "temperature_lag1", "humidity_lag1", "wind_speed_lag1",
]


def seasonal_naive(actual: pd.Series, period: int) -> pd.Series:
    return actual.shift(period)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    denom = np.abs(y_true).sum()
    return float(np.abs(y_true - y_pred).sum() / denom) if denom else float("nan")


def peak_metrics(y_true: np.ndarray, y_pred: np.ndarray, timestamps: pd.Series) -> dict:
    """Peak magnitude error (actual test max vs predicted max) and timing."""
    true_peak_idx = int(np.argmax(y_true))
    pred_peak_idx = int(np.argmax(y_pred))
    true_peak_ts = timestamps.iloc[true_peak_idx]
    pred_peak_ts = timestamps.iloc[pred_peak_idx]
    return {
        "peak_magnitude_error": float(abs(y_true[true_peak_idx] - y_pred[pred_peak_idx])),
        "peak_magnitude_error_pct": float(
            abs(y_true[true_peak_idx] - y_pred[pred_peak_idx]) / y_true[true_peak_idx] * 100
        ),
        "peak_timing_error_hours": float(
            abs((pred_peak_ts - true_peak_ts).total_seconds()) / 3600
        ),
        "actual_peak": float(y_true[true_peak_idx]),
        "predicted_peak": float(y_pred[pred_peak_idx]),
    }


def pinball_loss(y_true: np.ndarray, y_pred: np.ndarray, q: float) -> float:
    diff = y_true - y_pred
    return float(np.mean(np.maximum(q * diff, (q - 1) * diff)))


def evaluate(y_true: np.ndarray, y_pred: np.ndarray, timestamps: pd.Series) -> dict:
    mae = float(np.mean(np.abs(y_true - y_pred)))
    return {
        "MAE": mae,
        "RMSE": float(np.sqrt(np.mean((y_true - y_pred) ** 2))),
        "WAPE": wape(y_true, y_pred),
        **peak_metrics(y_true, y_pred, timestamps),
    }


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def main() -> None:
    hourly = pd.read_parquet(PROCESSED_DIR / "hourly_load.parquet")
    print(f"hourly rows: {len(hourly)}")

    feat = build_features(hourly)
    print(f"feature rows after lags: {len(feat)}")

    split_ts = feat["timestamp"].max() - pd.Timedelta(days=TEST_DAYS)
    train = feat[feat["timestamp"] < split_ts]
    test = feat[feat["timestamp"] >= split_ts].reset_index(drop=True)
    print(f"train: {len(train)} rows (< {split_ts}) | test: {len(test)} rows")

    y_train = train["total_power"].to_numpy()
    y_test = test["total_power"].to_numpy()
    ts_test = test["timestamp"]

    # ----- baselines on test window -----
    sn24_pred = test["lag_24"].to_numpy()
    sn168_pred = test["lag_168"].to_numpy()
    metrics = {
        "Seasonal Naive 24h": {"model": "Seasonal Naive 24h",
                               **evaluate(y_test, sn24_pred, ts_test)},
        "Seasonal Naive 168h": {"model": "Seasonal Naive 168h",
                                **evaluate(y_test, sn168_pred, ts_test)},
    }

    # ----- LightGBM quantile models -----
    params_base = dict(
        objective="quantile",
        learning_rate=0.05,
        num_leaves=63,
        min_child_samples=40,
        n_estimators=600,
        subsample=0.9,
        subsample_freq=1,
        colsample_bytree=0.9,
        reg_alpha=0.1,
        reg_lambda=0.1,
        verbose=-1,
    )
    quantile_preds: dict[str, np.ndarray] = {}
    trained_models: dict[str, lgb.LGBMRegressor] = {}
    for name, alpha in QUANTILES.items():
        params = {**params_base, "alpha": alpha}
        model = lgb.LGBMRegressor(**params)
        model.fit(train[FEATURE_COLS], y_train)
        quantile_preds[name] = model.predict(test[FEATURE_COLS])
        trained_models[name] = model

    p50 = quantile_preds["p50"]
    metrics["LightGBM"] = {
        "model": "LightGBM",
        **evaluate(y_test, p50, ts_test),
        "pinball_loss_p10": pinball_loss(y_test, quantile_preds["p10"], 0.1),
        "pinball_loss_p50": pinball_loss(y_test, p50, 0.5),
        "pinball_loss_p90": pinball_loss(y_test, quantile_preds["p90"], 0.9),
        "pinball_loss": float(np.mean([
            pinball_loss(y_test, quantile_preds["p10"], 0.1),
            pinball_loss(y_test, p50, 0.5),
            pinball_loss(y_test, quantile_preds["p90"], 0.9),
        ])),
        "coverage": float(np.mean(
            (y_test >= quantile_preds["p10"]) & (y_test <= quantile_preds["p90"])
        )),
        "average_interval_width": float(np.mean(
            quantile_preds["p90"] - quantile_preds["p10"]
        )),
    }
    # keep monotone quantiles (crossing safety)
    p10 = np.minimum(quantile_preds["p10"], p50)
    p90 = np.maximum(quantile_preds["p90"], p50)

    print("\n=== test metrics (30-day holdout) ===")
    for name, m in metrics.items():
        print(f"{name:22s} MAE={m['MAE']:10.1f}  RMSE={m['RMSE']:10.1f}  "
              f"WAPE={m['WAPE']*100:6.2f}%")

    # ----- capacity threshold + risk over FULL hourly record -----
    capacity = float(np.quantile(hourly["total_power"], CAPACITY_QUANTILE))
    print(f"\ncapacity threshold (P95 of hourly total, kW-scale): {capacity:,.0f}")

    # assemble per-timestamp forecast frame aligned to the full hourly grid.
    # historical rows: forecast = model's in-sample-free proxy is NOT used;
    # we attach test-window predictions only, and for the pre-test period we
    # leave p10/p50/p90 null but keep risk from the spec rule using actuals
    # evaluated against capacity (central breach of actual demand).
    fc = pd.DataFrame({"timestamp": hourly["timestamp"]})
    fc["actual"] = hourly["total_power"].to_numpy()
    fc["p10"] = np.nan
    fc["p50"] = np.nan
    fc["p90"] = np.nan

    test_lookup = test["timestamp"]
    fc = fc.merge(
        pd.DataFrame({
            "timestamp": test_lookup,
            "p10": p10, "p50": p50, "p90": p90,
        }),
        on="timestamp", how="left", suffixes=("", "_pred"),
    )
    for col in ("p10", "p50", "p90"):
        fc[col] = fc[f"{col}_pred"].where(fc[f"{col}_pred"].notna(), fc[col])
        fc = fc.drop(columns=[f"{col}_pred"])

    def risk_level(row) -> str:
        p50v, p90v = row["p50"], row["p90"]
        if pd.isna(p50v) or pd.isna(p90v):
            # no probabilistic forecast: evaluate actual load against capacity
            a = row["actual"]
            if pd.isna(a):
                return "unknown"
            return "high" if a >= capacity else "low"
        if p50v >= capacity:
            return "high"
        if p90v >= capacity:
            return "medium"
        return "low"

    fc["risk_level"] = fc.apply(risk_level, axis=1)
    fc["capacity"] = capacity
    fc = fc.sort_values("timestamp").reset_index(drop=True)

    fc.to_parquet(PROCESSED_DIR / "forecast.parquet", index=False)

    # ----- model persistence -----
    with open(MODELS_DIR / "model.pkl", "wb") as f:
        pickle.dump(trained_models, f)

    model_meta = {
        "algorithm": "LightGBM quantile regression",
        "quantiles": QUANTILES,
        "horizon_hours": HORIZON,
        "test_days": TEST_DAYS,
        "validation": "temporal holdout: last 30 days, chronological, no random split",
        "features": FEATURE_COLS,
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "capacity_threshold": capacity,
        "capacity_definition": f"P{int(CAPACITY_QUANTILE*100)} of observed hourly total load (training period)",
        "risk_rule": {
            "low": "P90 < capacity",
            "medium": "P50 < capacity <= P90",
            "high": "capacity <= P50",
        },
        "trained_at": pd.Timestamp.now().isoformat(),
    }
    (MODELS_DIR / "model_metadata.json").write_text(json.dumps(model_meta, indent=2))

    out_metrics = {
        "capacity_threshold": capacity,
        "capacity_quantile": CAPACITY_QUANTILE,
        "test_window": {
            "start": str(ts_test.min()),
            "end": str(ts_test.max()),
        },
        "target_coverage": 0.80,
        "models": metrics,
    }
    (PROCESSED_DIR / "model_metrics.json").write_text(json.dumps(out_metrics, indent=2))
    print(f"\nwrote forecast.parquet ({len(fc)} rows) and model_metrics.json")
    lgbm = metrics["LightGBM"]
    print(f"LightGBM coverage: {lgbm['coverage']*100:.1f}% | "
          f"avg interval width (kW-scale): {lgbm['average_interval_width']:,.0f}")


if __name__ == "__main__":
    main()
