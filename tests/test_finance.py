"""Engine output must match the hand-worked values in the team brief / verification sheet."""

import pytest

from finance import (SCENARIO_1, SCENARIO_2, compute, foreign_cost_at,
                     irp_forward, ppp_rate, real_rate, sensitivity)

approx = lambda v, tol=0.01: pytest.approx(v, abs=tol)


def test_formulas():
    assert foreign_cost_at(20_000, 0.03, 1) == approx(20_600)
    assert ppp_rate(5.80, 0.02, 0.03, 1) == approx(5.7437, 1e-4)
    assert irp_forward(5.80, 0.03, 0.04, 1) == approx(5.7442, 1e-4)
    assert real_rate(0.03, 0.02) == approx(0.0098, 1e-4)


def test_scenario_1():
    r = compute(SCENARIO_1)
    assert r["cost_at_departure_foreign"] == approx(20_600)
    assert r["myr_needed_if_convert_later"] == approx(118_320)
    assert r["pv_convert_later"] == approx(114_873.79)
    assert r["pv_convert_now"] == approx(114_884.62)
    assert r["pv_forward"] == approx(r["pv_convert_now"])   # IRP holds
    assert r["verdict"].startswith("Either")


def test_scenario_2():
    r = compute(SCENARIO_2)
    assert r["myr_needed_if_convert_later"] == approx(120_640)
    assert r["pv_convert_later"] == approx(117_126.21)
    assert r["saving_from_converting_now"] == approx(2_241.59)
    assert r["real_rate_my"] == approx(-0.0096, 1e-4)
    assert r["fisher_i_my_to_match_foreign_real"] == approx(0.0501, 1e-3)
    assert r["verdict"] == "Convert now"


def test_sensitivity():
    s = sensitivity(SCENARIO_1, "pi_my", 0.04)
    assert s["change"]["myr_needed_if_convert_later"] == approx(2_320)
    assert s["change"]["pv_convert_now"] == approx(0)
