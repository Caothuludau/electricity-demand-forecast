"""Risk evaluation rule from the project specification.

    P90 <  C          -> low
    P50 <  C <=  P90  -> medium   (uncertainty-driven risk)
    C    <= P50       -> high     (central forecast breach)

When no probabilistic forecast exists, the actual load is compared to the
capacity threshold (central breach check only).
"""
from __future__ import annotations

import math
from typing import Optional


def evaluate_risk(p50: Optional[float], p90: Optional[float],
                  capacity: float, actual: Optional[float] = None) -> str:
    if p50 is not None and p90 is not None and not math.isnan(p50) and not math.isnan(p90):
        if p50 >= capacity:
            return "high"
        if p90 >= capacity:
            return "medium"
        return "low"
    if actual is not None and not math.isnan(actual):
        return "high" if actual >= capacity else "low"
    return "unknown"
