"""Baseline and supervised models selected on a future validation block."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor, early_stopping, log_evaluation
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from src.feature_engineering import TARGET, feature_columns

RANDOM_STATE = 42


@dataclass
class TrainedModel:
    name: str
    estimator: object
    params: dict
    valid_mae: float
    test_prediction: np.ndarray
    feature_importance: dict[str, float] = field(default_factory=dict)


def _xy(frame: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    columns = feature_columns()
    return frame[columns], frame[TARGET].to_numpy(dtype=float)


def _importance(estimator: object, columns: list[str]) -> dict[str, float]:
    model = estimator
    if hasattr(estimator, "named_steps"):
        model = estimator.named_steps.get("model", estimator)
    values = getattr(model, "feature_importances_", None)
    if values is None:
        coef = getattr(model, "coef_", None)
        if coef is None:
            return {}
        values = np.abs(np.ravel(coef))
    total = float(np.sum(values)) or 1.0
    return {column: float(value) / total for column, value in zip(columns, values)}


def _seasonal_naive(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> TrainedModel:
    prediction = test["lag_168"].to_numpy(dtype=float)
    valid_prediction = valid["lag_168"].to_numpy(dtype=float)
    return TrainedModel(
        name="seasonal_naive",
        estimator=None,
        params={"rule": "same hour, previous week (lag 168)"},
        valid_mae=float(mean_absolute_error(valid[TARGET], valid_prediction)),
        test_prediction=prediction,
    )


def _ridge(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> TrainedModel:
    x_train, y_train = _xy(train)
    x_valid, y_valid = _xy(valid)
    x_test, _ = _xy(test)
    best: tuple[float, Pipeline, dict] | None = None
    for alpha in (0.1, 1.0, 10.0, 100.0):
        pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("model", Ridge(alpha=alpha, random_state=RANDOM_STATE)),
            ]
        )
        pipeline.fit(x_train, y_train)
        score = float(mean_absolute_error(y_valid, pipeline.predict(x_valid)))
        params = {"alpha": alpha}
        if best is None or score < best[0]:
            best = (score, pipeline, params)
    assert best is not None
    score, pipeline, params = best
    return TrainedModel(
        name="ridge",
        estimator=pipeline,
        params=params,
        valid_mae=score,
        test_prediction=np.asarray(pipeline.predict(x_test), dtype=float),
        feature_importance=_importance(pipeline, list(x_train.columns)),
    )


def _random_forest(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> TrainedModel:
    x_train, y_train = _xy(train)
    x_valid, y_valid = _xy(valid)
    x_test, _ = _xy(test)
    best: tuple[float, RandomForestRegressor, dict] | None = None
    for max_depth in (12, 20):
        model = RandomForestRegressor(
            n_estimators=200,
            max_depth=max_depth,
            min_samples_leaf=2,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
        model.fit(x_train, y_train)
        score = float(mean_absolute_error(y_valid, model.predict(x_valid)))
        params = {"n_estimators": 200, "max_depth": max_depth, "min_samples_leaf": 2}
        if best is None or score < best[0]:
            best = (score, model, params)
    assert best is not None
    score, model, params = best
    return TrainedModel(
        name="random_forest",
        estimator=model,
        params=params,
        valid_mae=score,
        test_prediction=np.asarray(model.predict(x_test), dtype=float),
        feature_importance=_importance(model, list(x_train.columns)),
    )


def _lightgbm(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> TrainedModel:
    x_train, y_train = _xy(train)
    x_valid, y_valid = _xy(valid)
    x_test, _ = _xy(test)
    best: tuple[float, LGBMRegressor, dict] | None = None
    for learning_rate in (0.05, 0.1):
        for num_leaves in (31, 63):
            model = LGBMRegressor(
                n_estimators=500,
                learning_rate=learning_rate,
                num_leaves=num_leaves,
                min_child_samples=20,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=RANDOM_STATE,
                verbosity=-1,
            )
            model.fit(
                x_train,
                y_train,
                eval_set=[(x_valid, y_valid)],
                callbacks=[early_stopping(40), log_evaluation(0)],
            )
            score = float(mean_absolute_error(y_valid, model.predict(x_valid)))
            params = {
                "learning_rate": learning_rate,
                "num_leaves": num_leaves,
                "n_estimators": int(model.best_iteration_ or model.n_estimators),
                "subsample": 0.8,
                "colsample_bytree": 0.8,
            }
            if best is None or score < best[0]:
                best = (score, model, params)
    assert best is not None
    score, model, params = best
    return TrainedModel(
        name="lightgbm",
        estimator=model,
        params=params,
        valid_mae=score,
        test_prediction=np.asarray(model.predict(x_test), dtype=float),
        feature_importance=_importance(model, list(x_train.columns)),
    )


def _xgboost(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> TrainedModel:
    x_train, y_train = _xy(train)
    x_valid, y_valid = _xy(valid)
    x_test, _ = _xy(test)
    best: tuple[float, XGBRegressor, dict] | None = None
    for learning_rate in (0.05, 0.1):
        for max_depth in (4, 6):
            model = XGBRegressor(
                n_estimators=500,
                learning_rate=learning_rate,
                max_depth=max_depth,
                subsample=0.8,
                colsample_bytree=0.8,
                objective="reg:squarederror",
                random_state=RANDOM_STATE,
                early_stopping_rounds=40,
                n_jobs=-1,
            )
            model.fit(x_train, y_train, eval_set=[(x_valid, y_valid)], verbose=False)
            score = float(mean_absolute_error(y_valid, model.predict(x_valid)))
            best_iteration = int(getattr(model, "best_iteration", model.n_estimators) or model.n_estimators)
            params = {
                "learning_rate": learning_rate,
                "max_depth": max_depth,
                "n_estimators": best_iteration + 1,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
            }
            if best is None or score < best[0]:
                best = (score, model, params)
    assert best is not None
    score, model, params = best
    return TrainedModel(
        name="xgboost",
        estimator=model,
        params=params,
        valid_mae=score,
        test_prediction=np.asarray(model.predict(x_test), dtype=float),
        feature_importance=_importance(model, list(x_train.columns)),
    )


def train_all(train: pd.DataFrame, valid: pd.DataFrame, test: pd.DataFrame) -> list[TrainedModel]:
    """Fit every model. Validation labels are used only to choose hyperparameters."""
    return [
        _seasonal_naive(train, valid, test),
        _ridge(train, valid, test),
        _random_forest(train, valid, test),
        _xgboost(train, valid, test),
        _lightgbm(train, valid, test),
    ]
