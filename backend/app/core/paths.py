"""Locate the trained model, raw history, and files written by imports."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
IMPORTED_DIR = BACKEND_DIR / "data" / "imported"
OBSERVATIONS_PATH = IMPORTED_DIR / "observations.csv"
FORECASTS_PATH = IMPORTED_DIR / "forecasts.csv"

RAW_NAME = "Tetuan City power consumption.csv"


def first_existing(candidates: list[Path]) -> Path:
    for path in candidates:
        if path.exists():
            return path
    searched = ", ".join(str(path) for path in candidates)
    raise FileNotFoundError(f"None of these paths exist: {searched}")


def raw_csv() -> Path:
    return first_existing(
        [
            Path("/app/document") / RAW_NAME,
            REPO_ROOT / "document" / RAW_NAME,
            REPO_ROOT / "notebooks" / RAW_NAME,
            REPO_ROOT / "source_code" / "data" / "raw" / "tetouan_power_consumption.csv",
        ]
    )


def model_pkl() -> Path:
    return first_existing(
        [
            Path("/app/models/final_forecast_models.pkl"),
            REPO_ROOT / "notebooks" / "models" / "final_forecast_models.pkl",
            BACKEND_DIR / "models" / "final_forecast_models.pkl",
        ]
    )


def evaluation_json() -> Path:
    return first_existing(
        [
            Path("/app/data/model_evaluation.json"),
            REPO_ROOT / "notebooks" / "output" / "model_evaluation.json",
            BACKEND_DIR / "data" / "model_evaluation.json",
        ]
    )


def feature_pipeline():
    for folder in (Path("/app"), REPO_ROOT / "notebooks", BACKEND_DIR):
        if (folder / "feature_pipeline.py").exists():
            folder_text = str(folder)
            if folder_text not in sys.path:
                sys.path.insert(0, folder_text)
            break
    import feature_pipeline as pipeline

    return pipeline
