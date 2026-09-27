"""Train the Tetouan demand models and write metrics, predictions and figures."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.data_loader import aggregate_hourly, load_raw
from src.evaluation import (
    breach_by_hour,
    capacity_threshold,
    dataset_profile,
    grouped_importance,
    peak_scores,
    regression_scores,
    save_figures,
    write_metrics,
)
from src.feature_engineering import TARGET, temporal_split, build_features
from src.models import train_all

OUTPUT_DIR = ROOT / "outputs"
FIGURE_DIR = OUTPUT_DIR / "figures"
REPORT_FIGURE_DIR = ROOT.parent / "report" / "figures"


def _block_summary(name: str, frame) -> dict:
    return {
        "name": name,
        "rows": int(len(frame)),
        "start": frame["timestamp"].min().isoformat(sep=" "),
        "end": frame["timestamp"].max().isoformat(sep=" "),
    }


def main() -> None:
    raw = load_raw()
    hourly = aggregate_hourly(raw)
    featured = build_features(hourly)
    train, valid, test = temporal_split(featured)
    models = train_all(train, valid, test)

    threshold = capacity_threshold(train, quantile=0.95)
    profile = dataset_profile(hourly, featured)
    raw_summary = {
        "raw_rows": int(len(raw)),
        "raw_start": raw["timestamp"].min().isoformat(sep=" "),
        "raw_end": raw["timestamp"].max().isoformat(sep=" "),
        "frequency": "10 minutes",
    }

    scores = {}
    peaks = {}
    predictions = {}
    params = {}
    valid_mae = {}
    for model in models:
        y_true = test[TARGET].to_numpy(dtype=float)
        scores[model.name] = regression_scores(y_true, model.test_prediction)
        peaks[model.name] = peak_scores(test, model.test_prediction, threshold)
        predictions[model.name] = model.test_prediction
        params[model.name] = model.params
        valid_mae[model.name] = model.valid_mae

    lightgbm = next(model for model in models if model.name == "lightgbm")
    importance = dict(sorted(lightgbm.feature_importance.items(), key=lambda item: item[1], reverse=True))
    naive_mae = scores["seasonal_naive"]["mae_kw"]
    improvement = {
        name: float((naive_mae - row["mae_kw"]) / naive_mae * 100.0) for name, row in scores.items()
    }

    payload = {
        "raw": raw_summary,
        "profile": profile,
        "splits": [_block_summary(name, frame) for name, frame in (("train", train), ("valid", valid), ("test", test))],
        "threshold_quantile": 0.95,
        "threshold_kw": threshold,
        "selected_params": params,
        "valid_mae_kw": valid_mae,
        "test_scores": scores,
        "mae_improvement_vs_naive_pct": improvement,
        "peak": peaks,
        "lightgbm_importance": importance,
        "lightgbm_importance_groups": grouped_importance(importance),
        "breach_rate_by_hour_pct": breach_by_hour(hourly, threshold),
        "test_breach_rate_by_hour_pct": breach_by_hour(test, threshold),
    }

    prediction_frame = test[["timestamp", TARGET]].rename(columns={TARGET: "actual_kw"}).copy()
    for name, values in predictions.items():
        prediction_frame[name] = values
    prediction_frame["threshold_kw"] = threshold

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    prediction_frame.to_csv(OUTPUT_DIR / "predictions.csv", index=False)
    write_metrics(payload, OUTPUT_DIR / "metrics.json")
    save_figures(hourly, test, predictions, importance, threshold, scores, profile, FIGURE_DIR)

    REPORT_FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    for image in FIGURE_DIR.glob("*.png"):
        shutil.copy2(image, REPORT_FIGURE_DIR / image.name)

    print(json.dumps({
        "threshold_kw": round(threshold, 1),
        "test_scores": {name: {k: round(v, 2) for k, v in row.items()} for name, row in scores.items()},
        "improvement_pct": {name: round(value, 2) for name, value in improvement.items()},
        "peak_lightgbm": {k: round(v, 3) if isinstance(v, float) else v for k, v in peaks["lightgbm"].items()},
        "top_features": list(importance)[:8],
        "groups": {k: round(v, 3) for k, v in grouped_importance(importance).items()},
        "acf": profile["acf"],
        "corr": {k: round(v, 3) for k, v in profile["corr_with_demand"].items()},
        "peak_hour_mean": profile["peak_hour_mean"],
        "splits": payload["splits"],
    }, indent=2))


if __name__ == "__main__":
    main()
