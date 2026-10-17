"""Unit helpers.

The Tetuan dataset records zone power readings whose scale (~32,000 per zone,
~71,000 total mean) corresponds to kilowatts, not watts — consistent with the
UCI documentation treating values as kW-equivalent power per reading.

The dashboard presents megawatts; conversion is centralized here.
"""
KW_PER_MW = 1_000.0


def kw_to_mw(kw: float | None) -> float | None:
    return None if kw is None else kw / KW_PER_MW
