"""Shipping rules: weight-based price, free over a threshold."""

from __future__ import annotations

FREE_SHIPPING_FROM = 50.00   # orders of 50.00 or more ship free
BASE_FEE = 4.99
PER_KG = 1.25


def shipping_cost(order_total: float, weight_kg: float) -> float:
    """Shipping cost for an order, rounded to cents."""
    if weight_kg < 0:
        raise ValueError("weight must be non-negative")
    if order_total >= FREE_SHIPPING_FROM:
        return 0.0
    return round(BASE_FEE + PER_KG * weight_kg, 2)
