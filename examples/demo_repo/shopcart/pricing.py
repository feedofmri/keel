"""Pricing rules for the demo shop."""

from __future__ import annotations


def apply_discount(price: float, percent: float) -> float:
    """Return `price` reduced by `percent` percent, rounded to cents."""
    if not 0 <= percent <= 100:
        raise ValueError("percent must be between 0 and 100")
    discounted = price * percent / 100
    return round(discounted, 2)


def line_total(unit_price: float, quantity: int, percent: float = 0.0) -> float:
    """Total for one cart line after a per-line discount."""
    if quantity < 0:
        raise ValueError("quantity must be non-negative")
    return round(apply_discount(unit_price, percent) * quantity, 2)


def cart_total(lines: list[tuple[float, int, float]]) -> float:
    """Sum of all line totals."""
    return round(sum(line_total(p, q, d) for p, q, d in lines), 2)
