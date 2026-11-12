"""
app.py - StudyAbroad Ringgit Coach (Streamlit UI).

Run with:  streamlit run app.py

Every number on screen comes from finance.py. The AI Coach tab only
explains those numbers.
"""

from __future__ import annotations

import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

import finance
from finance import Inputs
from scenarios import (DESTINATIONS, ILLUSTRATIVE_LABEL, PRESETS, SCENARIO_1,
                       SCENARIO_2)

st.set_page_config(page_title="StudyAbroad Ringgit Coach", page_icon="💱",
                   layout="wide")

# ---------- formatting helpers ----------


def rm(v: float) -> str:
    """RM with 2 decimals, sign before RM."""
    return f"-RM{abs(v):,.2f}" if v < 0 else f"RM{v:,.2f}"


def rm_signed(v: float) -> str:
    return f"+{rm(v)}" if v > 0 else rm(v)


def fx(v: float) -> str:
    return f"{v:,.4f}"


def pct(v: float) -> str:
    """Decimal rate to percent with 2 decimals."""
    return f"{v * 100:.2f}%"


def fc(v: float, cur: str) -> str:
    return f"{cur} {v:,.2f}"


def short_verdict(verdict: str) -> str:
    return verdict.split(" - ")[0].strip()


def illustrative_note() -> None:
    st.caption(f"⚠️ **{ILLUSTRATIVE_LABEL}.** For learning only.")


# ---------- sidebar inputs ----------

FIELD_KEYS = {
    "cost_foreign": "w_cost", "months": "w_months", "spot": "w_spot",
    "i_my": "w_i_my", "i_f": "w_i_f", "pi_my": "w_pi_my", "pi_f": "w_pi_f",
}
PCT_FIELDS = {"i_my", "i_f", "pi_my", "pi_f"}


def load_preset(cur: str) -> None:
    p = PRESETS[cur]
    for f, key in FIELD_KEYS.items():
        v = getattr(p, f)
        st.session_state[key] = round(v * 100, 2) if f in PCT_FIELDS else v
    st.session_state["w_months"] = int(p.months)
    st.session_state["w_cost"] = float(p.cost_foreign)


def on_currency_change() -> None:
    load_preset(st.session_state["w_currency"])


if "w_currency" not in st.session_state:
    st.session_state["w_currency"] = "GBP"
    load_preset("GBP")

with st.sidebar:
    st.header("Your plan")
    st.caption(f"⚠️ {ILLUSTRATIVE_LABEL}")
    currency = st.selectbox("Destination currency", list(PRESETS),
                            format_func=lambda c: DESTINATIONS[c],
                            key="w_currency", on_change=on_currency_change)
    st.number_input(f"Total cost abroad, today's prices ({currency})",
                    min_value=1000.0, max_value=1_000_000.0, step=500.0,
                    format="%.2f", key="w_cost")
    st.slider("Months to departure", 1, 36, key="w_months")
    st.number_input(f"Spot rate today (MYR per 1 {currency})", min_value=0.0001,
                    max_value=100.0, step=0.0100, format="%.4f", key="w_spot")
    st.subheader("Interest rates (per year)")
    st.slider("Malaysia interest rate (%)", 0.0, 15.0, step=0.01,
              format="%.2f%%", key="w_i_my")
    st.slider(f"Foreign interest rate, {currency} (%)", 0.0, 15.0, step=0.01,
              format="%.2f%%", key="w_i_f")
    st.subheader("Inflation (per year)")
    st.slider("Malaysia inflation (%)", 0.0, 15.0, step=0.01,
              format="%.2f%%", key="w_pi_my")
    st.slider(f"Foreign inflation, {currency} (%)", 0.0, 15.0, step=0.01,
              format="%.2f%%", key="w_pi_f")
    st.button("Reset to preset", on_click=load_preset, args=(currency,),
              width="stretch")

ss = st.session_state
inputs = Inputs(
    cost_foreign=float(ss["w_cost"]), months=int(ss["w_months"]),
    spot=float(ss["w_spot"]),
    i_my=round(ss["w_i_my"] / 100, 6), i_f=round(ss["w_i_f"] / 100, 6),
    pi_my=round(ss["w_pi_my"] / 100, 6), pi_f=round(ss["w_pi_f"] / 100, 6),
    currency=currency,
)
result = finance.compute(inputs)

# ---------- shared views ----------


def results_rows(r: dict, cur: str) -> list[dict]:
    return [
        {"Item": f"Cost at departure ({cur})", "Value": fc(r["cost_at_departure_foreign"], cur), "Theory": "Foreign inflation"},
        {"Item": f"PPP expected rate (MYR per {cur})", "Value": fx(r["ppp_expected_rate"]), "Theory": "PPP"},
        {"Item": f"IRP forward rate (MYR per {cur})", "Value": fx(r["irp_forward_rate"]), "Theory": "IRP"},
        {"Item": "MYR needed if you convert later", "Value": rm(r["myr_needed_if_convert_later"]), "Theory": "PPP"},
        {"Item": "PV of converting later", "Value": rm(r["pv_convert_later"]), "Theory": "PPP + discounting"},
        {"Item": f"{cur} to buy today and save abroad", "Value": fc(r["foreign_needed_today"], cur), "Theory": "Foreign interest"},
        {"Item": "PV of converting now", "Value": rm(r["pv_convert_now"]), "Theory": "Spot today"},
        {"Item": "MYR needed with a forward contract", "Value": rm(r["myr_needed_with_forward"]), "Theory": "IRP"},
        {"Item": "PV of forward contract", "Value": rm(r["pv_forward"]), "Theory": "IRP"},
        {"Item": "Saving from converting now", "Value": rm_signed(r["saving_from_converting_now"]), "Theory": "PV later minus PV now"},
        {"Item": "Real interest rate, Malaysia", "Value": pct(r["real_rate_my"]), "Theory": "Fisher"},
        {"Item": f"Real interest rate, {cur}", "Value": pct(r["real_rate_foreign"]), "Theory": "Fisher"},
        {"Item": "Malaysian rate where Fisher holds", "Value": pct(r["fisher_i_my_to_match_foreign_real"]), "Theory": "Fisher / IFE"},
        {"Item": "Verdict", "Value": short_verdict(r["verdict"]), "Theory": "Compare PVs"},
    ]


def show_results_table(r: dict, cur: str) -> None:
    st.dataframe(results_rows(r, cur), hide_index=True, width="stretch")


def verdict_card(r: dict) -> None:
    v = short_verdict(r["verdict"])
    gap = r["saving_from_converting_now"]
    if v == "Convert now":
        st.success(f"### ✅ Convert now\nConverting today is cheaper by **{rm(gap)}** "
                   "in today's money. Expected ringgit weakness (PPP) costs more "
                   "than the extra interest you would earn in MYR.")
    elif v == "Convert later":
        st.warning(f"### ⏳ Convert later\nWaiting is cheaper by **{rm(-gap)}** in "
                   "today's money. Your MYR savings earn enough interest to beat "
                   "the expected exchange-rate move (PPP).")
    else:
        st.info(f"### ⚖️ Either\nThe two options differ by only **{rm(abs(gap))}** "
                "(under 0.5%). When interest rates and inflation line up (Fisher, "
                "IRP), timing barely matters.")


# ---------- sensitivity helpers ----------

SENS_LABELS = {
    "pi_my": "Malaysia inflation", "pi_f": "Foreign inflation",
    "i_my": "Malaysia interest rate", "i_f": "Foreign interest rate",
    "spot": "Spot rate", "months": "Months to departure",
    "cost_foreign": "Total foreign cost",
}
SENS_ROWS = [
    ("ppp_expected_rate", "PPP expected rate", fx),
    ("myr_needed_if_convert_later", "MYR needed if convert later", rm),
    ("pv_convert_later", "PV of converting later", rm),
    ("pv_convert_now", "PV of converting now", rm),
    ("saving_from_converting_now", "Saving from converting now", rm),
    ("real_rate_my", "Real interest rate, Malaysia", pct),
]
SENS_WHY = {
    "pi_my": "Under PPP, higher Malaysian inflation means the ringgit is expected "
             "to weaken, so each foreign unit costs more MYR if you wait.",
    "pi_f": "Higher foreign inflation raises the foreign cost itself, while PPP "
            "expects the ringgit to strengthen a little against that currency.",
    "i_my": "A higher Malaysian interest rate grows your MYR savings faster, so "
            "you need less today to fund converting later (Fisher Effect).",
    "i_f": "A higher foreign interest rate means you can buy less foreign "
           "currency today and let it grow abroad, making converting now cheaper.",
    "spot": "The spot rate scales both options, so the MYR amounts move but the "
            "verdict depends on interest rates and inflation, not the spot level.",
    "months": "A longer wait compounds every gap between interest rates and "
              "inflation, so the difference between the options grows.",
    "cost_foreign": "A bigger budget scales every MYR amount; the verdict depends "
                    "on rates, not on the size of the budget.",
}


def fmt_field(field: str, v: float, cur: str = "") -> str:
    if field in PCT_FIELDS:
        return pct(v)
    if field == "spot":
        return fx(v)
    if field == "months":
        return f"{int(v)} months"
    return fc(v, cur) if cur else f"{v:,.2f}"


def sensitivity_rows(s: dict) -> list[dict]:
    rows = []
    for key, label, f in SENS_ROWS:
        ch = s["change"][key]
        change = (rm_signed(ch) if f is rm else
                  (f"{ch * 100:+.2f} pp" if f is pct else f"{ch:+.4f}"))
        rows.append({"Measure": label, "Before": f(s["before"][key]),
                     "After": f(s["after"][key]), "Change": change})
    rows.append({"Measure": "Verdict", "Before": short_verdict(s["before"]["verdict"]),
                 "After": short_verdict(s["after"]["verdict"]), "Change": ""})
    return rows


def sensitivity_sentence(s: dict, cur: str = "") -> str:
    field = s["field"]
    b, a = s["before"], s["after"]
    vb, va = short_verdict(b["verdict"]), short_verdict(a["verdict"])
    moved = ("rose" if s["change"]["saving_from_converting_now"] > 0 else
             "fell" if s["change"]["saving_from_converting_now"] < 0 else
             "did not change")
    verdict_part = (f"the verdict changed from **{vb}** to **{va}**" if vb != va
                    else f"the verdict stayed **{vb}**")
    return (f"Changing {SENS_LABELS[field]} from "
            f"{fmt_field(field, s['from'], cur)} to {fmt_field(field, s['to'], cur)}: "
            f"the saving from converting now {moved} "
            f"({rm(b['saving_from_converting_now'])} to "
            f"{rm(a['saving_from_converting_now'])}), and {verdict_part}. "
            f"{SENS_WHY[field]}")


def show_sensitivity(s: dict, cur: str = "") -> None:
    st.dataframe(sensitivity_rows(s), hide_index=True, width="stretch")
    st.markdown(sensitivity_sentence(s, cur))


# ---------- header ----------

st.title("💱 StudyAbroad Ringgit Coach")
st.markdown("**Know when to convert, what it will cost, and why.**")
illustrative_note()

tab_plan, tab_guided, tab_sens, tab_coach, tab_learn = st.tabs(
    ["📊 Plan", "🧭 Guided mode", "🔀 Sensitivity", "🤖 AI Coach", "📚 Learn"])

# ---------- Tab 1: Plan ----------

with tab_plan:
    c1, c2, c3 = st.columns(3)
    c1.metric("PV of converting later", rm(result["pv_convert_later"]))
    c2.metric("PV of converting now", rm(result["pv_convert_now"]))
    c3.metric("Saving from converting now",
              rm_signed(result["saving_from_converting_now"]))
    verdict_card(result)

    left, right = st.columns([1, 1])
    with left:
        st.subheader("Results from the finance engine")
        show_results_table(result, currency)
    with right:
        path = finance.cost_path(inputs)
        months_axis = [p["month"] for p in path]
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(go.Scatter(
            x=months_axis, y=[p["cost_foreign"] for p in path],
            name=f"Foreign cost ({currency})", mode="lines+markers",
            hovertemplate=f"Month %{{x}}<br>{currency} %{{y:,.2f}}<extra></extra>"),
            secondary_y=False)
        fig.add_trace(go.Scatter(
            x=months_axis, y=[p["myr_needed"] for p in path],
            name="MYR needed (at PPP rate)", mode="lines+markers",
            hovertemplate="Month %{x}<br>RM%{y:,.2f}<extra></extra>"),
            secondary_y=True)
        fig.update_layout(title="Cost over time until departure", height=360,
                          margin=dict(l=10, r=10, t=50, b=10),
                          legend=dict(orientation="h", y=-0.2),
                          hovermode="x unified")
        fig.update_xaxes(title_text="Months from today")
        fig.update_yaxes(title_text=currency, secondary_y=False, tickformat=",.0f")
        fig.update_yaxes(title_text="MYR", secondary_y=True, tickformat=",.0f")
        st.plotly_chart(fig, width="stretch")

        labels = ["Convert now", "Convert later", "Forward contract"]
        values = [result["pv_convert_now"], result["pv_convert_later"],
                  result["pv_forward"]]
        bar = go.Figure(go.Bar(
            x=labels, y=values, text=[rm(v) for v in values],
            textposition="outside",
            marker_color=["#2E86AB", "#F18F01", "#6C757D"],
            hovertemplate="%{x}<br>RM%{y:,.2f}<extra></extra>"))
        lo, hi = min(values), max(values)
        pad = max((hi - lo) * 0.6, hi * 0.01)
        bar.update_layout(title="Present value in today's MYR (lower is cheaper)",
                          height=340, margin=dict(l=10, r=10, t=50, b=10),
                          yaxis=dict(range=[lo - pad, hi + pad], tickformat=",.0f",
                                     title="MYR"))
        st.plotly_chart(bar, width="stretch")
        st.caption("The bar axis is zoomed in so small differences are visible.")

# ---------- Tab 2: Guided mode ----------

with tab_guided:
    illustrative_note()
    st.subheader("Step-by-step worked example")
    source = st.radio("Walk through", ["Scenario 1 (worked example)",
                                       "My sidebar inputs"], horizontal=True)
    g = SCENARIO_1 if source.startswith("Scenario") else inputs
    gr = finance.compute(g)
    cur, t = g.currency, g.t
    st.caption(f"{fc(g.cost_foreign, cur)} total cost, {int(g.months)} months "
               f"(t = {t:.2f} years), spot {fx(g.spot)} MYR per {cur}, "
               f"i_MY {pct(g.i_my)}, i_f {pct(g.i_f)}, "
               f"inflation MY {pct(g.pi_my)}, inflation abroad {pct(g.pi_f)}.")

    with st.expander("Step 1. How much will it cost abroad when you leave?", expanded=True):
        st.latex(r"Cost_t = Cost_0 \times (1 + \pi_f)^t")
        st.markdown(f"= {g.cost_foreign:,.2f} x (1 + {g.pi_f:.4f})^{t:.2f} "
                    f"= **{fc(gr['cost_at_departure_foreign'], cur)}**")
        st.info(f"Prices abroad rise with foreign inflation, so your {cur} "
                "budget grows before you even leave.")

    with st.expander("Step 2. What exchange rate does PPP expect?"):
        st.latex(r"S_t = S_0 \times \left(\frac{1 + \pi_{MY}}{1 + \pi_f}\right)^t")
        st.markdown(f"= {fx(g.spot)} x ((1 + {g.pi_my:.4f}) / (1 + {g.pi_f:.4f}))^{t:.2f} "
                    f"= **{fx(gr['ppp_expected_rate'])} MYR per {cur}**")
        st.info("Purchasing Power Parity: the currency with higher inflation is "
                "expected to weaken. Here the rate moves with the inflation gap.")

    with st.expander("Step 3. How many ringgit will you need if you convert later?"):
        st.latex(r"MYR_{later} = Cost_t \times S_t")
        st.markdown(f"= {gr['cost_at_departure_foreign']:,.2f} x "
                    f"{fx(gr['ppp_expected_rate'])} = "
                    f"**{rm(gr['myr_needed_if_convert_later'])}**")
        st.info("This is the ringgit amount you must have on departure day if "
                "you wait and convert at the PPP-expected rate.")

    with st.expander("Step 4. What is that worth in today's money?"):
        st.latex(r"PV_{later} = \frac{MYR_{later}}{(1 + i_{MY})^t}")
        st.markdown(f"= {rm(gr['myr_needed_if_convert_later'])} / "
                    f"(1 + {g.i_my:.4f})^{t:.2f} = **{rm(gr['pv_convert_later'])}**")
        st.info("Your savings earn Malaysian interest while you wait, so you need "
                "less than that amount today.")

    with st.expander("Step 5. What if you convert now instead?"):
        st.latex(r"PV_{now} = \frac{Cost_t}{(1 + i_f)^t} \times S_0")
        st.markdown(f"= {gr['cost_at_departure_foreign']:,.2f} / (1 + {g.i_f:.4f})^{t:.2f} "
                    f"x {fx(g.spot)} = {fc(gr['foreign_needed_today'], cur)} x "
                    f"{fx(g.spot)} = **{rm(gr['pv_convert_now'])}**")
        st.info(f"Buy {cur} today and let it earn foreign interest until you leave. "
                "Compare this with Step 4: the smaller number is the cheaper plan.")

    with st.expander("Step 6. IRP check: does a forward contract give the same answer?"):
        st.latex(r"F = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t")
        st.markdown(f"F = {fx(g.spot)} x ((1 + {g.i_my:.4f}) / (1 + {g.i_f:.4f}))^{t:.2f} "
                    f"= **{fx(gr['irp_forward_rate'])}**  \n"
                    f"MYR with forward = {rm(gr['myr_needed_with_forward'])}, "
                    f"PV = **{rm(gr['pv_forward'])}** vs PV now {rm(gr['pv_convert_now'])}")
        st.info("Interest Rate Parity: locking a forward rate costs the same as "
                "converting now and saving abroad, so there is no free lunch. "
                "The IFE uses the same formula to predict the future spot rate.")

    with st.expander("Step 7. Fisher Effect: are your savings growing in real terms?"):
        st.latex(r"r = \frac{1 + i}{1 + \pi} - 1")
        st.markdown(f"Malaysia: (1 + {g.i_my:.4f}) / (1 + {g.pi_my:.4f}) - 1 = "
                    f"**{pct(gr['real_rate_my'])}**  \n"
                    f"{cur}: (1 + {g.i_f:.4f}) / (1 + {g.pi_f:.4f}) - 1 = "
                    f"**{pct(gr['real_rate_foreign'])}**")
        st.info("The real rate is what your money gains after inflation. A "
                "negative real rate means your savings lose buying power.")

    st.markdown("#### Verdict")
    verdict_card(gr)

# ---------- Tab 3: Sensitivity ----------

with tab_sens:
    illustrative_note()
    st.subheader("What happens if one thing changes?")
    st.caption("Uses your sidebar plan as the starting point, unless you click a preset.")

    p1, p2 = st.columns(2)
    if p1.button("Scenario 2: Malaysian inflation 2% -> 4%", width="stretch"):
        ss["sens"] = {"result": finance.sensitivity(SCENARIO_1, "pi_my", 0.04),
                      "title": "Scenario 2: Malaysian inflation rises from 2% to 4% "
                               "(i_MY stays 3%)", "cur": SCENARIO_1.currency}
    if p2.button("Scenario 3: Fisher holds", width="stretch"):
        ss["sens"] = {"result": finance.sensitivity(SCENARIO_2, "i_my", 0.0501),
                      "title": "Scenario 3: Fisher holds. Starting from Scenario 2 "
                               "(Malaysian inflation 4%), the Malaysian interest "
                               "rate adjusts from 3.00% to 5.01%",
                      "cur": SCENARIO_2.currency, "fisher": True}

    with st.form("sens_form"):
        f1, f2 = st.columns(2)
        field = f1.selectbox("Input to change", list(SENS_LABELS),
                             format_func=lambda k: SENS_LABELS[k])
        current = getattr(inputs, field)
        shown = current * 100 if field in PCT_FIELDS else current
        unit = {"spot": f"MYR per {currency}", "months": "months",
                "cost_foreign": currency}.get(field, "%")
        new_val = f2.number_input(f"New value ({unit})", value=float(shown),
                                  step=0.01 if field != "months" else 1.0,
                                  format="%.4f" if field == "spot" else "%.2f")
        if st.form_submit_button("Run sensitivity"):
            v = new_val / 100 if field in PCT_FIELDS else new_val
            if field == "months":
                v = int(min(max(v, 1), 36))
            ss["sens"] = {"result": finance.sensitivity(inputs, field, v),
                          "title": f"Your plan: {SENS_LABELS[field]}",
                          "cur": currency}

    if "sens" in ss:
        st.markdown(f"#### {ss['sens']['title']}")
        show_sensitivity(ss["sens"]["result"], ss["sens"]["cur"])
        if ss["sens"].get("fisher"):
            st.success("When the Malaysian interest rate rises enough to cover the "
                       "extra inflation, both currencies earn the same real return "
                       "(Fisher Effect). The expected ringgit weakness is exactly "
                       "offset, so timing stops mattering.")

# ---------- Tab 4: AI Coach ----------

with tab_coach:
    illustrative_note()
    st.info("AI Coach coming in the next step.")

# ---------- Tab 5: Learn ----------

with tab_learn:
    st.info("Learn content coming in the next step.")
