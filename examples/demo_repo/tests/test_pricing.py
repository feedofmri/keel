import pytest

from shopcart.pricing import apply_discount, cart_total, line_total


def test_no_discount_keeps_price():
    assert apply_discount(20.0, 0) == 20.0


def test_ten_percent_discount():
    assert apply_discount(50.0, 10) == 45.0


def test_line_total_with_discount():
    assert line_total(10.0, 3, 50) == 15.0


def test_invalid_percent_rejected():
    with pytest.raises(ValueError):
        apply_discount(10.0, 120)


def test_negative_quantity_rejected():
    with pytest.raises(ValueError):
        line_total(10.0, -1)


def test_cart_total_mixed_lines():
    assert cart_total([(10.0, 2, 0), (8.0, 1, 25)]) == 26.0
