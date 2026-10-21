"""FastAPI application entry point."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Electricity Demand Forecasting API",
    description=(
        "Serves the Tetouan raw series, hourly aggregates, EDA charts, "
        "the saved LightGBM/XGBoost evaluation, and forecasts from imported rows."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
