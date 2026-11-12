"""Each verdict (Either, Convert now, Convert later) has a preset that produces it."""

import pytest

from finance import compute, sensitivity
from scenarios import SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4

approx = lambda v, tol=0.01: pytest.approx(v, abs=tol)


def test_scenario_3_fisher_holds_gives_either():
    assert compute(SCENARIO_3)["verdict"].startswith("Either")


def test_scenario_4_convert_later():
    r = compute(SCENARIO_4)
    assert r["pv_convert_later"] == approx(112_685.71)
    assert r["pv_convert_now"] == approx(114_884.62)
    assert r["saving_from_converting_now"] == approx(-2_198.90)
    assert r["real_rate_my"] == approx(0.0294, 1e-4)
    assert r["verdict"] == "Convert later"


def test_scenario_4_preset_flips_either_to_later():
    s = sensitivity(SCENARIO_1, "i_my", 0.05)
    assert s["before"]["verdict"].startswith("Either")
    assert s["after"]["verdict"] == "Convert later"


def test_verdict_follows_real_rate_gap():
    """Higher real rate abroad -> convert now; higher at home -> convert later."""
    for scenario, expected in [(SCENARIO_2, "Convert now"), (SCENARIO_4, "Convert later")]:
        r = compute(scenario)
        home_better = r["real_rate_my"] > r["real_rate_foreign"]
        assert r["verdict"] == expected
        assert home_better == (expected == "Convert later")
