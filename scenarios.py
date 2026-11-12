"""
scenarios.py - destination presets for StudyAbroad Ringgit Coach.

All rates here are ILLUSTRATIVE, not current market data. They exist so
students can explore the models with realistic-looking numbers.

Exchange rates are MYR per 1 unit of foreign currency.
"""

from __future__ import annotations

from dataclasses import replace

from finance import SCENARIO_1, SCENARIO_2, Inputs

__all__ = [
    "SCENARIO_1",
    "SCENARIO_2",
    "SCENARIO_3",
    "PRESETS",
    "DESTINATIONS",
    "ILLUSTRATIVE_LABEL",
]

ILLUSTRATIVE_LABEL = "Illustrative data - not current market rates"

# Scenario 3: Fisher holds. Malaysian inflation is 4% (as in Scenario 2) but
# the Malaysian interest rate has adjusted to 5.01%, the nominal rate that
# gives the same real return as the foreign currency. Timing stops mattering.
SCENARIO_3 = replace(SCENARIO_2, i_my=0.0501)

# Destination presets. GBP is exactly Scenario 1 so the defaults reproduce
# the verified worked example.
PRESETS: dict[str, Inputs] = {
    "GBP": SCENARIO_1,
    "AUD": Inputs(cost_foreign=40_000, months=12, spot=3.0500,
                  i_my=0.03, i_f=0.0410, pi_my=0.02, pi_f=0.0320,
                  currency="AUD"),
    "USD": Inputs(cost_foreign=30_000, months=12, spot=4.4000,
                  i_my=0.03, i_f=0.0425, pi_my=0.02, pi_f=0.0280,
                  currency="USD"),
}

DESTINATIONS: dict[str, str] = {
    "GBP": "United Kingdom (GBP)",
    "AUD": "Australia (AUD)",
    "USD": "United States (USD)",
}
