"""API for the five visualization tabs and trained-model inference."""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.core.paths import evaluation_json, model_pkl, raw_csv
from app.services import catalog, trained_model

router = APIRouter(prefix="/api")


def _failure(exc: Exception) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


@router.get("/health")
def health() -> dict:
    loaded = {"raw_csv": False, "model": False, "evaluation": False}
    try:
        raw_csv()
        loaded["raw_csv"] = True
    except Exception:
        pass
    try:
        model_pkl()
        loaded["model"] = True
    except Exception:
        pass
    try:
        evaluation_json()
        loaded["evaluation"] = True
    except Exception:
        pass
    return {"status": "ok" if all(loaded.values()) else "degraded", "datasets_loaded": loaded}


@router.get("/raw")
def raw_data(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)) -> dict:
    try:
        return catalog.raw_page(limit, offset)
    except Exception as exc:
        raise _failure(exc) from exc


@router.get("/processed")
def processed_data() -> dict:
    try:
        return catalog.processed_view()
    except Exception as exc:
        raise _failure(exc) from exc


@router.get("/eda")
def eda() -> dict:
    try:
        return catalog.eda_view()
    except Exception as exc:
        raise _failure(exc) from exc


@router.get("/model")
def model() -> dict:
    try:
        return trained_model.model_view()
    except Exception as exc:
        raise _failure(exc) from exc


@router.get("/forecast")
def forecast() -> dict:
    try:
        return {
            "observations": trained_model.stored_observations(),
            "forecasts": trained_model.stored_forecasts(),
        }
    except Exception as exc:
        raise _failure(exc) from exc


@router.post("/forecast/import")
async def import_forecast(file: UploadFile = File(...)) -> dict:
    try:
        upload = pd.read_csv(file.file)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read CSV: {exc}") from exc
    if upload.empty:
        raise HTTPException(status_code=422, detail="Import file has no rows")
    try:
        return trained_model.import_observations(upload)
    except Exception as exc:
        raise _failure(exc) from exc
