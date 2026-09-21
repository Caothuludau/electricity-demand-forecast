# Energy Demand Intelligence — Tetuan City Power Consumption Dashboard

A production-quality electricity demand forecasting and capacity-planning dashboard for the
[Tetuan City power consumption dataset](https://archive.ics.uci.edu/dataset/849/power+consumption+of+tetouan+city).

The system follows one pipeline:

```
Historical Load → Forecast → Forecast Uncertainty → Peak Risk → Capacity Decision
```

All numbers shown in the UI are computed by the backend from real data. Nothing is invented:
no mock metrics, no fabricated probabilities, no random train/test splits.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Raw data                                                                   │
│  document/Tetuan City power consumption.csv                                 │
│  52,416 rows · 10-min intervals · 2017-01-01 → 2017-12-30                   │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │  backend/scripts/build_dataset.py
               │  parse %m/%d/%Y %H:%M  →  resample("1h").mean()
               │  total_power = zone1 + zone2 + zone3 (hourly means)
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Processed data (Parquet)              backend/data/processed/              │
│  hourly_load.parquet · weather_hourly.parquet · daily_metrics.parquet       │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │  backend/scripts/run_forecast.py
               │  • calendar + cyclical + lag + rolling + weather features
               │  • Seasonal Naive 24h / 168h baselines
               │  • LightGBM quantile regression (P10 / P50 / P90)
               │  • temporal holdout: last 30 days, chronological only
               │  • capacity threshold = P95 of observed hourly total load
               │  • risk rule:  P90 < C → low · P50 < C ≤ P90 → medium ·
               │                C ≤ P50 → high
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FastAPI backend                       backend/app  (port 8000)             │
│  Pydantic-typed REST API · CORS · lru-cached dataset loading                │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │  /api/*  (JSON, all loads in MW)
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  React + TypeScript + Vite frontend    frontend/  (port 5173)               │
│  TanStack Query · Recharts · Tailwind v4 · React Router                     │
│  No CSV reading, no forecasting logic — the frontend only renders API data  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Domain rules (enforced in code)

| Rule | Where |
|---|---|
| Hourly demand = mean of the six 10-minute observations per hour | `backend/scripts/build_dataset.py` |
| `Total_Power = Zone1 + Zone2 + Zone3` (hourly means) | `build_dataset.py` |
| 1-hour-ahead forecast | `backend/scripts/run_forecast.py` |
| Baselines: Seasonal Naive 24h and 168h | `run_forecast.py` |
| Main model: LightGBM (quantile objective, α = 0.1 / 0.5 / 0.9) | `run_forecast.py` |
| Probabilistic bands P10 / P50 / P90, crossing-safe | `run_forecast.py` |
| Capacity threshold = P95 of observed hourly total load (99.4 MW) | `run_forecast.py` |
| Risk rule (never invents breach probabilities) | `backend/app/core/risk.py` |
| Reserve margins 10% / 15% / 20%: `Required = Forecast Peak × (1 + margin)` | `analytics_service.py` |
| Temporal validation only — last 30 days, chronological | `run_forecast.py` |
| Unit semantics: dataset is kW-scale (zone mean ≈ 32,000); UI displays MW | `backend/app/core/units.py` |

---

## Project structure

```
data_science/
├── document/
│   └── Tetuan City power consumption.csv    # raw source data (10-min)
├── backend/
│   ├── app/
│   │   ├── api/routers.py                   # all /api routes
│   │   ├── core/config.py                   # paths, supported zones, margins
│   │   ├── core/risk.py                     # risk decision rule
│   │   ├── core/units.py                    # kW → MW conversion
│   │   ├── schemas/schemas.py               # Pydantic response models
│   │   ├── services/analytics_service.py    # overview, profiles, scenarios
│   │   ├── services/data_service.py         # cached Parquet/JSON loaders
│   │   └── main.py                          # FastAPI app + CORS
│   ├── data/processed/                      # generated Parquet + JSON artifacts
│   ├── models/model.pkl                     # trained LightGBM models
│   ├── scripts/build_dataset.py             # CSV → hourly Parquet
│   ├── scripts/run_forecast.py              # train, evaluate, forecast, risk
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/                      # charts, KPIs, risk, layout, UI
│   │   ├── hooks/useApi.ts                  # TanStack Query hooks
│   │   ├── pages/DashboardPage.tsx          # main dashboard
│   │   ├── pages/DataDriversPage.tsx        # optional drivers page
│   │   ├── services/api.ts                  # typed fetch layer
│   │   ├── types/api.ts                     # TypeScript API interfaces
│   │   └── lib/utils.ts                     # formatting helpers
│   ├── vite.config.ts                       # /api proxy → 127.0.0.1:8000
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Setup

### Backend (Python 3.12)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# 1. Process the raw CSV into hourly Parquet
python scripts/build_dataset.py
# (reads ../document/Tetuan City power consumption.csv)

# 2. Train models, evaluate, build forecast + risk artifacts
python scripts/run_forecast.py

# 3. Start the API
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1
```

Interactive API docs: http://127.0.0.1:8000/docs

### Frontend (Node 20+)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api → 127.0.0.1:8000)
```

Production build:

```bash
npm run build        # type-checks with tsc, bundles to dist/
npm run preview      # serve the built bundle on :4173
```

### Docker Compose

```bash
docker compose up --build
# frontend → http://localhost:5173
# backend  → http://localhost:8000 (docs at /docs)
```

The frontend container serves the production bundle via nginx and proxies
`/api/*` to the backend inside the compose network (same-origin — no CORS or
build-time API URL needed). On first start the backend container processes the
raw CSV, trains the models, and refreshes all artifacts automatically.

### Build notes

- The backend image installs `libgomp1`, required by LightGBM's native binary.
- Dockerfiles in this package are the clean, proxy-free versions — no
  corporate TLS CA or proxy pinning is required.

## API documentation

Base URL: `http://localhost:8000` · All load values in **MW** (dataset is kW-scale; converted).

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard/overview` | KPI row: current load, next-hour P50 forecast, P10–P90 range, capacity risk, required capacity (15% default), data range |
| `GET /api/load/history` | Historical load. Params: `start`, `end` (ISO), `granularity=hourly\|daily`, `zone=total\|zone1\|zone2\|zone3` |
| `GET /api/forecast` | Per-hour actual, P10/P50/P90, capacity, risk level. Params: `start`, `end` |
| `GET /api/risk/peak-windows` | Most severe risk hours under the P50/P90 rule. Param: `limit` (1–50, default 12) |
| `GET /api/capacity/scenarios` | Required capacity at 10% / 15% / 20% reserve vs current capacity |
| `GET /api/model/metrics` | MAE, RMSE, WAPE, peak errors, pinball loss, coverage, interval width for LightGBM + baselines; test window; target coverage |
| `GET /api/load/hourly-profile` | Average load + P10/P90 per hour of day |
| `GET /api/load/weekday-weekend` | Mean weekday vs weekend load per hour |
| `GET /api/load/zones` | Mean zone1/2/3 contribution per hour |
| `GET /api/load/monthly-distribution` | Tukey-fence boxplot stats per month |
| `GET /api/drivers/weather` | Temperature/humidity/wind-speed samples vs load (drivers page). Param: `limit` |
| `GET /api/data/quality` | Raw vs hourly row counts, missing/null counts, aggregation + unit notes |
| `GET /api/health` | Dataset load status + covered date range |

### Risk decision rule (spec-mandated)

Given forecast P50, P90 and capacity threshold `C`:

- `P90 < C` → **low**
- `P50 < C ≤ P90` → **medium**
- `C ≤ P50` → **high**

For historical hours that predate the probabilistic test window (no P50/P90 exists), risk is
computed from the observed actual load against `C` and is labeled as an observed breach — the UI
distinguishes these from forecast-rule outcomes. No breach probabilities are ever invented.

---

## Results (Nov 30 – Dec 30, 2017 temporal holdout)

| Model | MAE | RMSE | WAPE | Peak timing error |
|---|---|---|---|---|
| Seasonal Naive 24h | 2.07 MW | 3.30 MW | 3.25% | 24 h |
| Seasonal Naive 168h | 1.78 MW | 2.62 MW | 2.78% | 504 h |
| **LightGBM (main)** | **1.01 MW** | **1.45 MW** | **1.58%** | 24 h |

- LightGBM reduces WAPE by **43%** vs the best baseline.
- P10–P90 empirical coverage: **69.8%** vs the 80% target — the dashboard states honestly that
  intervals are too narrow and the model is not calibrated on this window (no cosmetic fixes).
- Capacity threshold: **99.4 MW** (P95 of hourly total load). Reserve scenarios: +10% → 100.9 MW,
  +15% → 105.5 MW, +20% → 110.0 MW.

---

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `""` (same origin, via Vite proxy) | Base URL of the FastAPI backend, e.g. `http://localhost:8000`. Set it when the backend runs on another host/port. |

See `frontend/.env.example`.

### Mock-data mode vs production-data mode

The frontend always fetches from the real backend — there is no hidden mock data path, so every
number displayed is a real computed result. If the backend is not running, each panel shows an
explicit error state (`API unavailable — is the backend running on port 8000?`) rather than fake
numbers. "Production mode" is simply: run `build_dataset.py` + `run_forecast.py` against your own
CSV, restart the API, and the whole dashboard reflects your data.

---

## Validation policy

- **Temporal validation only**: models are trained on everything before the final 30 days and
  evaluated chronologically on that holdout. Random splits are never used.
- All metrics (MAE, RMSE, WAPE, pinball loss, coverage, peak errors) are produced by the backend
  pipeline and served via `/api/model/metrics`. The frontend performs no forecasting and computes
  no metrics.
