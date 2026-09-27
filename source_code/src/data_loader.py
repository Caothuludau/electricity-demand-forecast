"""Load the UCI Tetouan power series and aggregate it to hourly demand."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
CSV_NAME = "tetouan_power_consumption.csv"

DATASET_URLS = (
    "https://archive.ics.uci.edu/static/public/849/power+consumption+of+tetouan+city.zip",
    "https://archive.ics.uci.edu/ml/machine-learning-databases/00616/Tetuan%20City%20power%20consumption.csv",
)

COLUMN_MAP = {
    "datetime": "timestamp",
    "temperature": "temperature",
    "humidity": "humidity",
    "wind speed": "wind_speed",
    "general diffuse flows": "general_diffuse_flows",
    "diffuse flows": "diffuse_flows",
    "zone 1 power consumption": "zone1_kw",
    "zone 2 power consumption": "zone2_kw",
    "zone 3 power consumption": "zone3_kw",
}

WEATHER_COLUMNS = (
    "temperature",
    "humidity",
    "wind_speed",
    "general_diffuse_flows",
    "diffuse_flows",
)
ZONE_COLUMNS = ("zone1_kw", "zone2_kw", "zone3_kw")


def _canon(name: str) -> str:
    return " ".join(str(name).strip().lower().split())


def download_raw_csv(destination: Path | None = None, timeout: int = 120) -> Path:
    """Download the UCI file once and cache it under data/raw."""
    destination = destination or (RAW_DIR / CSV_NAME)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return destination

    last_error: Exception | None = None
    for url in DATASET_URLS:
        try:
            request = Request(url, headers={"User-Agent": "educational-demand-forecast/1.0"})
            with urlopen(request, timeout=timeout) as response:
                payload = response.read()
            if url.endswith(".zip") or payload[:2] == b"PK":
                with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                    csv_members = [name for name in archive.namelist() if name.lower().endswith(".csv")]
                    if not csv_members:
                        raise FileNotFoundError("UCI archive does not contain a CSV file")
                    destination.write_bytes(archive.read(csv_members[0]))
            else:
                destination.write_bytes(payload)
            return destination
        except Exception as exc:  # try the next public mirror
            last_error = exc
    raise RuntimeError(f"Could not download the Tetouan dataset: {last_error}")


def load_raw(csv_path: Path | None = None) -> pd.DataFrame:
    """Read the 10-minute series and return a sorted frame with canonical names."""
    csv_path = download_raw_csv(csv_path)
    frame = pd.read_csv(csv_path)
    frame = frame.rename(columns={column: COLUMN_MAP.get(_canon(column), _canon(column)) for column in frame.columns})
    missing = [name for name in ("timestamp", *WEATHER_COLUMNS, *ZONE_COLUMNS) if name not in frame.columns]
    if missing:
        raise ValueError(f"Unexpected columns {list(frame.columns)}; missing {missing}")

    frame["timestamp"] = pd.to_datetime(frame["timestamp"], format="%m/%d/%Y %H:%M", errors="coerce")
    if frame["timestamp"].isna().mean() > 0.05:
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame = frame.dropna(subset=["timestamp"]).sort_values("timestamp")
    for column in (*WEATHER_COLUMNS, *ZONE_COLUMNS):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=list(ZONE_COLUMNS))
    frame["total_kw"] = frame[list(ZONE_COLUMNS)].sum(axis=1)
    return frame.reset_index(drop=True)


def aggregate_hourly(raw: pd.DataFrame) -> pd.DataFrame:
    """Average weather and city demand inside each clock hour.

    City demand at the 10-minute stamp is the sum of the three distribution
    zones. The hourly target is the mean of those stamps, so the series stays
    in kilowatts of average power rather than a sum of repeated power readings.
    """
    frame = raw.set_index("timestamp").sort_index()
    aggregations = {column: "mean" for column in (*WEATHER_COLUMNS, *ZONE_COLUMNS, "total_kw")}
    hourly = frame.resample("h").agg(aggregations)
    observed = frame["total_kw"].resample("h").count().rename("n_samples")
    hourly = hourly.join(observed)
    hourly = hourly[hourly["n_samples"] > 0].drop(columns=["n_samples"])
    hourly = hourly.dropna().reset_index()
    return hourly
