# Team Brief: StudyAbroad Ringgit Coach, Full-Stack Version

UTP, GFB3043 International Financial Management, FinBridge AI Innovation Challenge.

**Status:** the Streamlit app on `main` is the version we submit by Mon 16 Nov 2026. This brief describes the full-stack version being built on the `fullstack` branch. It must not put the submission at risk: never merge it into `main` until it matches the Streamlit app feature for feature and every test passes.

## What stays the same

- **Product:** a web app for Malaysian university students (non-finance) saving in MYR for an exchange semester or postgrad abroad.
- **Problem:** students do not know whether to convert MYR now or later, how foreign inflation raises their costs, or whether their savings grow in real terms.
- **Finance concepts (CLO3):** IRP, PPP, Fisher Effect and International Fisher Effect. Exchange rates are MYR per 1 foreign unit.
- **Core design rule:** `finance.py` computes every number. The AI Coach only EXPLAINS those numbers and never calculates.
- **Data:** all rates are ILLUSTRATIVE. Every page with inputs shows "Illustrative data - not current market rates".
- **Verified results:** Scenario 1 gives PV convert later RM114,873.79, PV convert now RM114,884.62, verdict "Either". Scenario 2 gives saving from converting now RM2,241.60 and real MYR rate -0.96%. Scenario 3 gives "Either". Scenario 4 gives "Convert later" (saving RM2,198.90).
- **Style:** RM with 2 decimals, exchange rates with 4 decimals, percents with 2 decimals. No em dashes in any text.

## What changes

Streamlit is replaced by a separate backend API and frontend website.

```
Frontend (React + TypeScript, Vite)     what students see
        |  HTTPS, JSON
Backend (FastAPI, Python)               thin API layer, holds the Gemini key
        |
finance.py, coach.py, scenarios.py      unchanged, shared with the Streamlit app
```

**Why:** full control over design and layout, faster interactions (no full-page reruns), and room to grow into a real product (accounts, saved plans, live rates).

## Folder structure

| Path | Purpose | Status |
| --- | --- | --- |
| `finance.py` | calculation engine. Do not change formulas or preset values | done, shared |
| `coach.py` | Gemini prompt, `run_sensitivity` tool and chat loop | done, shared |
| `scenarios.py` | destination presets and Scenarios 1 to 4 | done, shared |
| `app.py` | Streamlit app (the submission) | done, keep working |
| `backend/main.py` | FastAPI endpoints | done |
| `backend/schemas.py` | request validation (Pydantic) | done |
| `backend/requirements.txt` | backend dependencies | done |
| `tests/test_api.py` | API tests, including Scenario 1 to 4 checks | done |
| `frontend/` | React + TypeScript website (Vite), all five pages | done, first version |

## Backend API (done)

Run from the repo root: `uvicorn backend.main:app --reload`, then open http://localhost:8000/docs to try every endpoint.

| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /api/health` | none | status, whether the coach has a key, model name |
| `GET /api/presets` | none | GBP, AUD and USD preset inputs, and the scenario list |
| `POST /api/compute` | inputs | `finance.compute()` result and `cost_path()` for charts |
| `POST /api/sensitivity` | inputs, field, new_value | `finance.sensitivity()` before, after and change |
| `GET /api/scenarios/{2,3,4}` | none | preset what-if for each verdict |
| `POST /api/chat` | inputs, last messages | coach reply text and any `run_sensitivity` tables |

**Inputs object** (rates as decimals, 3% = 0.03):
`{"cost_foreign": 20000, "months": 12, "spot": 5.8, "i_my": 0.03, "i_f": 0.04, "pi_my": 0.02, "pi_f": 0.03, "currency": "GBP"}`

**Rules:**
- Validation: months 1 to 36, spot and cost above 0, rates between -5% and 50%. Bad input returns HTTP 422.
- `/api/chat` returns 503 when there is no `GEMINI_API_KEY`, and 502 when Gemini fails. The frontend shows a friendly message and every other page keeps working.
- The Gemini key lives only on the backend as an environment variable. It is never sent to the browser or committed.
- The frontend sends at most the last 10 chat messages; the backend accepts up to 50 and `coach.py` trims to 10.

**Environment variables:** `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.6-flash`), `ALLOWED_ORIGINS` (comma-separated frontend URLs; default allows `http://localhost:5173` and `http://localhost:3000`).

## Frontend (first version done)

**Stack:** React + TypeScript with Vite, Plotly (`plotly.js-basic-dist-min`) for charts, KaTeX for formulas, plain CSS. Run with `npm install` then `npm run dev` inside `frontend/`; `/api` is proxied to the backend on port 8000. The frontend never calculates finance numbers; it only formats what the API returns.

**Redesign (13 Nov):** the first version copied the Streamlit layout and felt cluttered, so the site was redesigned around three ideas from fintech UX practice: answer first (like Wise's converter), progressive disclosure (details only on request), and ask only for what's needed. It now has four sections: **My plan** (destination, budget and departure date first; interest and inflation rates under "Economic assumptions"; one big answer card; four insight cards; charts and full table behind "Charts and all the numbers"), **What if?** (three story cards, one per verdict, plus a custom what-if), **Ask coach** (chat-first, the coach's numbers in an expandable panel) and **Learn** (step-by-step worked example, theories, key words, assumptions and sources). Phones get a bottom tab bar. Every feature below is still there; it is just reorganised.

**Original page spec (all features kept):**

1. **Plan:** input panel (destination, cost, months 1 to 36, spot, Malaysia and foreign interest rates, Malaysia and foreign inflation as percent sliders converted to decimals before sending). Shows three key figures, a verdict card (Convert now, Convert later or Either), a cost-over-time chart from `cost_path`, a present-value bar chart (now, later, forward) and the full results table.
2. **Guided mode:** Scenario 1 step by step (foreign cost growth, PPP rate, MYR needed later, PV later, convert now, IRP check, Fisher real rate). Each step shows the formula, the numbers plugged in, the result from the API and a 1 to 2 sentence plain-English meaning.
3. **Sensitivity:** pick one input and a new value, call `/api/sensitivity`, show a before, after and change table with one sentence on which way it moved and why. Three preset buttons from `/api/scenarios/2`, `/3` and `/4`, one per verdict.
4. **AI Coach:** chat on the left, the engine's current results on the right. Four suggested questions: "Should I convert now or later?", "Explain PPP with my numbers", "Is my saving growing in real terms?", "What if Malaysian inflation rises to 4%?". Show any `tool_results` as a before and after table inside the reply. A "Clear chat" button.
5. **Learn:** formulas, assumptions, limitations, glossary, references (Madura, International Financial Management, Cengage; Bank Negara Malaysia; Department of Statistics Malaysia; International Monetary Fund) and the AI-use disclosure.

**UI rules:** readable on a laptop screen recording, works on a phone, the illustrative-data label visible on every page with inputs, title "StudyAbroad Ringgit Coach" with the tagline "Know when to convert, what it will cost, and why."

## Deployment

| Part | Suggested host | Settings |
| --- | --- | --- |
| Backend | Render or Railway (free tier) | start command `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, env vars `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS=https://<frontend-url>` |
| Frontend | Vercel or Netlify (free tier) | env var `VITE_API_URL=https://<backend-url>` |

Free backends sleep when idle. Open the site a few minutes before any demo.

## Acceptance checks

- `pytest` passes from the repo root (finance, coach, scenarios and API tests).
- `uvicorn backend.main:app` starts with no errors, even with no API key.
- `POST /api/compute` with Scenario 1 inputs returns PV later RM114,873.79, PV now RM114,884.62, verdict "Either".
- `/api/scenarios/2`, `/3` and `/4` return Convert now, Either and Convert later.
- The frontend shows exactly the same numbers as the Streamlit app for the same inputs.
- The AI Coach page shows a friendly offline message when the backend returns 503, and the rest of the site works.
- `streamlit run app.py` still works on `main`.

## Work order

1. Backend API and tests (done on `fullstack`).
2. Frontend scaffold, API client and formatting helpers (done).
3. Plan, Sensitivity and Guided mode pages (done).
4. AI Coach page (done, tested with a real Gemini call).
5. Learn page (done).
6. Deploy backend, then frontend, and run the acceptance checks against the live URLs.
7. Merge into `main` only after the submission deadline, or once it fully matches the Streamlit app.

## Team notes

- Commit small, working steps with clear messages on the `fullstack` branch.
- Never commit API keys (`.streamlit/secrets.toml` and `.env` files are git-ignored).
- If a number looks wrong, check it with `python finance.py` before changing anything. The engine is the source of truth.
- AI-use disclosure: record which parts were built with AI assistance and how outputs were checked against `finance.py` and the tests.
