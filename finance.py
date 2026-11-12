"""
finance.py - calculation engine for StudyAbroad FX Coach

All numbers shown in the app come from this module. The AI Coach only
explains these results; it never calculates.

Conventions
- Exchange rates are quoted as MYR per 1 unit of foreign currency (e.g. MYR/GBP).
- Rates are annual decimals (3% = 0.03), compounded once a year.
- t is time in years (months / 12).
- All rates used in demos are ILLUSTRATIVE, not current market data.

Models (CLO3)
- Foreign cost growth: Cost_t = Cost_0 x (1 + pi_f)^t
- PPP expected spot:    S_t = S_0 x [(1 + pi_MY) / (1 + pi_f)]^t
- IRP forward:          F   = S_0 x [(1 + i_MY) / (1 + i_f)]^t
- IFE expected spot:    S_t = S_0 x [(1 + i_MY) / (1 + i_f)]^t
- Fisher real rate:     r   = (1 + i) / (1 + pi) - 1
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace


@dataclass(frozen=True)
class Inputs:
    cost_foreign: float      # total cost at today's prices, foreign currency
    months: float            # months until departure
    spot: float              # S0, MYR per 1 foreign unit
    i_my: float              # Malaysian interest rate (annual)
    i_f: float               # foreign interest rate (annual)
    pi_my: float             # Malaysian inflation (annual)
    pi_f: float              # foreign inflation (annual)
    currency: str = "GBP"

    @property
    def t(self) -> float:
        return self.months / 12


# ---------- core formulas ----------

def foreign_cost_at(cost0: float, pi_f: float, t: float) -> float:
    """Foreign cost after t years of foreign inflation."""
    return cost0 * (1 + pi_f) ** t


def ppp_rate(spot: float, pi_my: float, pi_f: float, t: float) -> float:
    """PPP-expected spot rate in t years (MYR per foreign unit)."""
    return spot * ((1 + pi_my) / (1 + pi_f)) ** t


def irp_forward(spot: float, i_my: float, i_f: float, t: float) -> float:
    """IRP forward rate for t years (MYR per foreign unit)."""
    return spot * ((1 + i_my) / (1 + i_f)) ** t


def ife_rate(spot: float, i_my: float, i_f: float, t: float) -> float:
    """International Fisher Effect expected spot rate (same form as IRP)."""
    return irp_forward(spot, i_my, i_f, t)


def real_rate(i: float, pi: float) -> float:
    """Exact Fisher real interest rate."""
    return (1 + i) / (1 + pi) - 1


def fisher_nominal(real: float, pi: float) -> float:
    """Nominal rate needed to earn a given real rate at inflation pi."""
    return (1 + real) * (1 + pi) - 1


# ---------- decision ----------

def compute(x: Inputs) -> dict:
    """Full result set for one scenario. Monetary values rounded for display."""
    t = x.t
    cost_t = foreign_cost_at(x.cost_foreign, x.pi_f, t)
    s_ppp = ppp_rate(x.spot, x.pi_my, x.pi_f, t)
    f_irp = irp_forward(x.spot, x.i_my, x.i_f, t)

    # Convert later: save in MYR at i_MY, convert at PPP-expected rate
    myr_later = cost_t * s_ppp
    pv_later = myr_later / (1 + x.i_my) ** t

    # Convert now: buy foreign currency today, save abroad at i_f
    foreign_needed_now = cost_t / (1 + x.i_f) ** t
    pv_now = foreign_needed_now * x.spot

    # Lock a forward contract today (IRP check: PV must equal convert-now)
    myr_forward = cost_t * f_irp
    pv_forward = myr_forward / (1 + x.i_my) ** t

    gap = pv_later - pv_now  # > 0 means converting now is cheaper
    if abs(gap) < 0.005 * pv_now:          # within 0.5% = practically equal
        verdict = "Either - difference is negligible"
    elif gap > 0:
        verdict = "Convert now"
    else:
        verdict = "Convert later"

    return {
        "inputs": asdict(x),
        "t_years": t,
        "cost_at_departure_foreign": round(cost_t, 2),
        "ppp_expected_rate": round(s_ppp, 4),
        "irp_forward_rate": round(f_irp, 4),
        "myr_needed_if_convert_later": round(myr_later, 2),
        "pv_convert_later": round(pv_later, 2),
        "foreign_needed_today": round(foreign_needed_now, 2),
        "pv_convert_now": round(pv_now, 2),
        "myr_needed_with_forward": round(myr_forward, 2),
        "pv_forward": round(pv_forward, 2),
        "saving_from_converting_now": round(gap, 2),
        "real_rate_my": round(real_rate(x.i_my, x.pi_my), 6),
        "real_rate_foreign": round(real_rate(x.i_f, x.pi_f), 6),
        "fisher_i_my_to_match_foreign_real": round(
            fisher_nominal(real_rate(x.i_f, x.pi_f), x.pi_my), 6
        ),
        "verdict": verdict,
    }


def sensitivity(base: Inputs, field: str, new_value: float) -> dict:
    """Change one input and report before, after and the change."""
    before = compute(base)
    after = compute(replace(base, **{field: new_value}))
    keys = [
        "ppp_expected_rate",
        "myr_needed_if_convert_later",
        "pv_convert_later",
        "pv_convert_now",
        "saving_from_converting_now",
        "real_rate_my",
    ]
    return {
        "field": field,
        "from": getattr(base, field),
        "to": new_value,
        "before": {k: before[k] for k in keys} | {"verdict": before["verdict"]},
        "after": {k: after[k] for k in keys} | {"verdict": after["verdict"]},
        "change": {k: round(after[k] - before[k], 6) for k in keys},
    }


def cost_path(x: Inputs, step_months: int = 1) -> list[dict]:
    """Month-by-month series for charts: foreign cost, PPP rate, MYR needed."""
    rows = []
    for m in range(0, int(x.months) + 1, step_months):
        t = m / 12
        c = foreign_cost_at(x.cost_foreign, x.pi_f, t)
        s = ppp_rate(x.spot, x.pi_my, x.pi_f, t)
        rows.append({
            "month": m,
            "cost_foreign": round(c, 2),
            "ppp_rate": round(s, 4),
            "myr_needed": round(c * s, 2),
        })
    return rows


# ---------- illustrative presets (NOT market data) ----------

SCENARIO_1 = Inputs(cost_foreign=20_000, months=12, spot=5.80,
                    i_my=0.03, i_f=0.04, pi_my=0.02, pi_f=0.03, currency="GBP")
SCENARIO_2 = replace(SCENARIO_1, pi_my=0.04)


if __name__ == "__main__":
    import json
    for name, s in [("Scenario 1", SCENARIO_1), ("Scenario 2", SCENARIO_2)]:
        print(name)
        print(json.dumps(compute(s), indent=2))
    print(json.dumps(sensitivity(SCENARIO_1, "pi_my", 0.04), indent=2))
