# StudyAbroad Ringgit Coach

**Know when to convert, what it will cost, and why.**

A Streamlit web app that helps Malaysian university students saving in ringgit (MYR) for an exchange semester or postgraduate study abroad decide **whether to convert now or later**, see how **foreign inflation** raises their costs, and check whether their **savings grow in real terms**.

Built for GFB3043 International Financial Management (UTP), FinBridge AI Innovation Challenge.

> ⚠️ **Illustrative data - not current market rates.** All interest, inflation and exchange rates in this app are for learning only.

## The problem

Students who are not finance majors face three questions with no easy answer:

1. Should I convert my ringgit now, or wait until I leave?
2. How much more will my trip cost after foreign inflation?
3. Is my saving actually growing once Malaysian inflation is taken into account?

## Features

| Tab | What it does |
| --- | --- |
| **Plan** | Sidebar inputs (destination, cost, months, spot, interest and inflation rates). Results table, verdict card (Convert now / Convert later / Either) and two charts. |
| **Guided mode** | Walks through Scenario 1 step by step: formula, numbers plugged in, result and a plain-English meaning. |
| **Sensitivity** | Change one input and see before / after / change, plus one preset per verdict: Scenario 2 (Malaysian inflation 2% to 4%, Convert now), Scenario 3 (Fisher holds, Either) and Scenario 4 (Malaysian rate 3% to 5%, Convert later). |
| **AI Coach** | A Gemini-powered tutor grounded in the engine's results. What-if questions are answered with a `run_sensitivity` tool that runs the finance engine in Python. |
| **Learn** | Formulas, assumptions, limitations, glossary and references. |

**Core design rule:** `finance.py` computes every number. The AI Coach only explains those numbers and never calculates. It receives the current inputs and results as JSON on every turn, and any what-if is run through `finance.sensitivity` before the model explains it.

## Finance formulas

Exchange rates are MYR per 1 unit of foreign currency; rates are annual decimals; `t = months / 12`.

| Concept | Formula |
| --- | --- |
| Foreign cost growth | `Cost_t = Cost_0 x (1 + pi_f)^t` |
| Purchasing Power Parity (PPP) | `S_t = S_0 x [(1 + pi_MY) / (1 + pi_f)]^t` |
| Interest Rate Parity (IRP) forward | `F = S_0 x [(1 + i_MY) / (1 + i_f)]^t` |
| International Fisher Effect (IFE) | `E[S_t] = S_0 x [(1 + i_MY) / (1 + i_f)]^t` |
| Fisher real rate | `r = (1 + i) / (1 + pi) - 1` |

**Decision:** PV of converting later = `Cost_t x S_t(PPP) / (1 + i_MY)^t`; PV of converting now = `Cost_t / (1 + i_f)^t x S_0`. If they are within 0.5% the verdict is *Either*.

### Verified scenarios (GBP, 12 months, spot 5.8000, cost GBP 20,000)

| Scenario | Inputs | Result |
| --- | --- | --- |
| 1 | i_MY 3%, i_f 4%, inflation MY 2%, abroad 3% | PV later RM114,873.79, PV now RM114,884.62, **Either** |
| 2 | Malaysian inflation rises to 4% | Saving from converting now RM2,241.60, real MYR rate -0.96%, **Convert now** |
| 3 | Inflation 4% and i_MY 5.01% (Fisher holds) | **Either** |
| 4 | From Scenario 1, i_MY rises to 5% | PV later RM112,685.71, saving from converting later RM2,198.90, real MYR rate 2.94%, **Convert later** |

Rule of thumb: the verdict follows the Fisher real-rate gap. A higher real rate abroad means convert now; a higher real rate in Malaysia means convert later.

## Project structure

```
app.py                          Streamlit UI (5 tabs)
finance.py                      calculation engine (single source of every number)
coach.py                        Gemini prompt, chat and tool calling
scenarios.py                    destination presets (GBP, AUD, USD)
tests/test_finance.py           engine checks against hand-worked values
tests/test_coach.py             chatbot tool mapping and grounding checks
.streamlit/secrets.toml.example template for your Gemini key
```

## Run locally

Requires Python 3.10 or newer.

```bash
git clone https://github.com/th4ifurXI/IFM_Group-Project-17.git
cd IFM_Group-Project-17
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

The app works without an API key; only the AI Coach tab is disabled.

### Add your Gemini API key

1. Get a free key at <https://aistudio.google.com/apikey>.
2. Copy `.streamlit/secrets.toml.example` to `.streamlit/secrets.toml`.
3. Paste your key:
   ```toml
   GEMINI_API_KEY = "your-key"
   GEMINI_MODEL = "gemini-3.6-flash"
   ```
4. Restart `streamlit run app.py`.

`secrets.toml` is in `.gitignore`, so it is never committed. Environment variables `GEMINI_API_KEY` and `GEMINI_MODEL` also work.

### Run tests

```bash
pytest
```

## Full-stack version (in progress, `fullstack` branch)

A FastAPI backend reuses `finance.py` and `coach.py` unchanged, ready for a React frontend. See [docs/team_brief_fullstack.md](docs/team_brief_fullstack.md) for the plan.

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Open http://localhost:8000/docs to try every endpoint. The backend reads `GEMINI_API_KEY` from an environment variable (not from `.streamlit/secrets.toml`).

## Deploy to Streamlit Community Cloud

1. Push the repo to GitHub (without `secrets.toml`).
2. Go to <https://share.streamlit.io> and sign in with GitHub.
3. Click **Create app**, choose this repository, branch `main`, main file `app.py`.
4. Open **Advanced settings**, pick Python 3.12 and paste into **Secrets**:
   ```toml
   GEMINI_API_KEY = "your-key"
   GEMINI_MODEL = "gemini-3.6-flash"
   ```
5. Click **Deploy**. Secrets can be edited later under the app's **Settings > Secrets**.

## Illustrative data note

All rates are illustrative and chosen to demonstrate the theories. They are not current market rates and must not be used for real financial decisions. The coach is a learning tool, not a licensed advisor.

## References

- Madura, J. *International Financial Management*. Cengage Learning (course textbook).
- Bank Negara Malaysia. <https://www.bnm.gov.my>
- Department of Statistics Malaysia. <https://www.dosm.gov.my>
- International Monetary Fund. <https://www.imf.org>

## AI-use disclosure

_[Placeholder: describe how the group used AI tools, for example code assistance and the Gemini model behind the coach, and how every number was checked against `finance.py` and the test suite.]_
