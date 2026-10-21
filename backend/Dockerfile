FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# libgomp1: runtime shared lib required by LightGBM's native binary

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY notebooks/feature_pipeline.py ./feature_pipeline.py
COPY notebooks/models/final_forecast_models.pkl ./models/final_forecast_models.pkl
COPY notebooks/output/model_evaluation.json ./data/model_evaluation.json
RUN mkdir -p /app/data/imported

# document/ is mounted at runtime. The saved notebook model is served as-is.
CMD ["python", "-B", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
