FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# libgomp1: runtime shared lib required by LightGBM's native binary

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# document/ (raw CSV) is mounted at runtime as a read-only volume.
# On startup: process the raw CSV if needed, train/refresh artifacts, then serve.
# If the raw CSV is absent, skip training and serve any pre-built artifacts.
CMD ["sh", "-c", "\
if [ -f document/'Tetuan City power consumption.csv' ]; then \
  python -B scripts/build_dataset.py && python -B scripts/run_forecast.py; \
fi; \
python -B -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
