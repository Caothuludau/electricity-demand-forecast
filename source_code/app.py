"""Streamlit demo: one-hour-ahead demand forecast and peak-capacity alerts."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
PREDICTIONS = ROOT / "outputs" / "predictions.csv"
METRICS = ROOT / "outputs" / "metrics.json"

MODEL_LABELS = {
    "seasonal_naive": "Seasonal Naive",
    "ridge": "Ridge regression",
    "random_forest": "Random Forest",
    "xgboost": "XGBoost",
    "lightgbm": "LightGBM",
}


def load_outputs() -> tuple[pd.DataFrame, dict]:
    frame = pd.read_csv(PREDICTIONS, parse_dates=["timestamp"])
    metrics = json.loads(METRICS.read_text(encoding="utf-8"))
    return frame, metrics


def main() -> None:
    st.set_page_config(page_title="Tetouan demand forecast", layout="wide")
    st.title("Tetouan short-term electricity demand")
    st.caption("One-hour-ahead forecast and capacity-threshold alerts on the held-out test block.")

    if not PREDICTIONS.exists() or not METRICS.exists():
        st.error("Forecast outputs are missing. From the source_code folder run: python run_pipeline.py")
        return

    frame, metrics = load_outputs()
    threshold = float(metrics["threshold_kw"])
    available = [name for name in MODEL_LABELS if name in frame.columns]

    with st.sidebar:
        st.header("View")
        model_name = st.selectbox("Model", available, index=available.index("lightgbm") if "lightgbm" in available else 0, format_func=lambda name: MODEL_LABELS[name])
        start, end = frame["timestamp"].min().to_pydatetime(), frame["timestamp"].max().to_pydatetime()
        window = st.slider("Test window", min_value=start, max_value=end, value=(start, end))

    view = frame[(frame["timestamp"] >= window[0]) & (frame["timestamp"] <= window[1])].copy()
    view["forecast_kw"] = view[model_name]
    view["alert"] = view["forecast_kw"] > threshold
    actual_breach = view["actual_kw"] > threshold
    hits = int((actual_breach & view["alert"]).sum())
    n_breach = int(actual_breach.sum())
    bar = 100.0 * hits / n_breach if n_breach else 0.0
    scores = metrics["test_scores"][model_name]

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("MAE", f"{scores['mae_kw'] / 1000:.2f} MW")
    col2.metric("RMSE", f"{scores['rmse_kw'] / 1000:.2f} MW")
    col3.metric("WAPE", f"{scores['wape_pct']:.2f}%")
    col4.metric("Breach anticipation", f"{bar:.1f}%")

    if view["alert"].any():
        st.warning(
            f"{int(view['alert'].sum())} hours in this window are forecast above the safety threshold "
            f"of {threshold / 1000:.2f} MW (training 95th percentile). Reserve margin should be armed "
            "one to two hours before the evening peak."
        )
    else:
        st.success("No hour in this window is forecast above the safety threshold.")

    fig, ax = plt.subplots(figsize=(11, 3.8))
    ax.plot(view["timestamp"], view["actual_kw"] / 1000, label="Actual", color="#222222", linewidth=1.1)
    ax.plot(view["timestamp"], view["forecast_kw"] / 1000, label=MODEL_LABELS[model_name], color="#c47b2b", linewidth=1.1)
    ax.axhline(threshold / 1000, color="#a33b3b", linestyle="--", label="Capacity threshold")
    ax.set_ylabel("Demand (MW)")
    ax.legend(loc="upper right")
    fig.autofmt_xdate()
    st.pyplot(fig, clear_figure=True)

    left, right = st.columns(2)
    with left:
        st.subheader("Hours flagged above capacity")
        alerts = view.loc[view["alert"], ["timestamp", "actual_kw", "forecast_kw"]].copy()
        if alerts.empty:
            st.write("None in the selected window.")
        else:
            alerts["actual_mw"] = alerts["actual_kw"] / 1000
            alerts["forecast_mw"] = alerts["forecast_kw"] / 1000
            st.dataframe(
                alerts[["timestamp", "actual_mw", "forecast_mw"]].tail(24),
                hide_index=True,
                use_container_width=True,
            )
    with right:
        st.subheader("What drives the LightGBM forecast")
        importance = metrics.get("lightgbm_importance", {})
        ranked = sorted(importance.items(), key=lambda item: item[1], reverse=True)[:8]
        chart = pd.DataFrame({"feature": [name for name, _ in ranked], "gain_share": [value for _, value in ranked]})
        st.bar_chart(chart.set_index("feature"))

    st.caption(
        "The model is trained only on earlier hours. Weather at the target hour is treated as a forecast "
        "that operators already have. Alerts compare the one-hour-ahead prediction with the training threshold."
    )


if __name__ == "__main__":
    main()
