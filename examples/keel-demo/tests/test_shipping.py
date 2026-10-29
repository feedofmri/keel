import pytest

from shopcart.shipping import shipping_cost


def test_small_order_pays_shipping():
    assert shipping_cost(20.0, 2.0) == 7.49


def test_large_order_ships_free():
    assert shipping_cost(80.0, 3.0) == 0.0


def test_negative_weight_rejected():
    with pytest.raises(ValueError):
        shipping_cost(10.0, -1)


def test_order_at_threshold_ships_free():
    assert shipping_cost(50.0, 1.0) == 0.0
