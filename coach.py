"""
coach.py - grounded AI Coach for StudyAbroad Ringgit Coach.

Design rule: finance.py computes every number. Gemini only EXPLAINS the
numbers it is given (the current compute() result as JSON) or the numbers
returned by the run_sensitivity tool, which runs finance.sensitivity in Python.

Prompt building, the tool definition, tool execution and the API call are
kept in separate functions so they can be unit tested without the API.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from typing import Any

import finance
from finance import Inputs

DEFAULT_MODEL = "gemini-3.6-flash"
MAX_HISTORY = 10          # messages sent to Gemini each turn
MAX_TOOL_ROUNDS = 3       # safety cap on function-calling loops

# Inputs the tool is allowed to change, with a plain-English label.
TOOL_FIELDS: dict[str, str] = {
    "pi_my": "Malaysian inflation",
    "pi_f": "foreign inflation",
    "i_my": "Malaysian interest rate",
    "i_f": "foreign interest rate",
    "spot": "spot exchange rate (MYR per 1 foreign unit)",
    "months": "months to departure",
    "cost_foreign": "total foreign cost",
}
RATE_FIELDS = {"pi_my", "pi_f", "i_my", "i_f"}

SYSTEM_INSTRUCTION = """You are StudyAbroad Ringgit Coach, a friendly tutor for Malaysian university students who are NOT finance majors. They are saving in Malaysian ringgit (MYR) for an exchange semester or postgraduate study abroad.

Rules you must always follow:
- Use ONLY numbers that appear in the PLAN DATA JSON below or in run_sensitivity tool results. Never calculate, estimate, round differently or invent any rate or amount.
- For any "what if" question that changes an input (inflation, interest rate, spot rate, months, cost), call the run_sensitivity tool and explain its before / after / change result. Rates are passed as decimals (4% = 0.04).
- Name the theory behind each point: PPP (Purchasing Power Parity), IRP (Interest Rate Parity), Fisher Effect or IFE (International Fisher Effect).
- Exchange rates are MYR per 1 unit of foreign currency.
- Mention that the data is illustrative, not current market rates.
- Keep answers under 150 words, using short plain bullet points. Explain jargon in everyday words. Do not use em dashes.
- Money format: RM with 2 decimals (e.g. RM114,873.79); exchange rates with 4 decimals; percents with 2 decimals.
- If asked for personal investment advice, which bank or product to choose, or anything off-topic, decline briefly with "I'm a learning tool, not a licensed advisor." and steer back to their study-abroad plan.

How to read the JSON: pv_convert_later and pv_convert_now are today's-money (present value) costs of each option; saving_from_converting_now > 0 means converting now is cheaper; pv_forward equal to pv_convert_now shows IRP holds; real_rate_my and real_rate_foreign are Fisher real rates as decimals; fisher_i_my_to_match_foreign_real is the Malaysian rate at which Fisher would hold."""


class CoachUnavailable(RuntimeError):
    """Raised when the coach cannot run (no API key or SDK missing)."""


# ---------- configuration ----------

def get_config(secrets: Any = None) -> tuple[str | None, str]:
    """Return (api_key, model). Reads st.secrets first, then env variables."""
    if secrets is None:
        try:
            import streamlit as st
            secrets = st.secrets
        except Exception:
            secrets = {}

    def _read(name: str) -> str | None:
        try:
            value = secrets.get(name) if secrets is not None else None
        except Exception:      # st.secrets raises if no secrets.toml exists
            value = None
        return value or os.environ.get(name)

    return _read("GEMINI_API_KEY"), _read("GEMINI_MODEL") or DEFAULT_MODEL


# ---------- prompt building ----------

def build_plan_json(inputs: Inputs, result: dict) -> str:
    """Current inputs and engine result as the JSON the model is grounded on."""
    return json.dumps(
        {"inputs": asdict(inputs), "result": result,
         "note": "Illustrative data, not current market rates."},
        indent=2,
    )


def build_system_instruction(inputs: Inputs, result: dict) -> str:
    return (f"{SYSTEM_INSTRUCTION}\n\nPLAN DATA (from finance.py):\n"
            f"{build_plan_json(inputs, result)}")


def build_history(messages: list[dict], limit: int = MAX_HISTORY) -> list[dict]:
    """Last `limit` chat messages as plain {'role', 'text'} dicts.

    App roles are 'user' / 'assistant'; Gemini roles are 'user' / 'model'.
    """
    out = []
    usable = [m for m in messages if not m.get("error")]
    for m in usable[-limit:]:
        role = "model" if m.get("role") == "assistant" else "user"
        text = (m.get("content") or "").strip()
        if text:
            out.append({"role": role, "text": text})
    return out


def build_contents(messages: list[dict], limit: int = MAX_HISTORY) -> list:
    """Convert chat history into google-genai Content objects."""
    from google.genai import types
    return [types.Content(role=h["role"], parts=[types.Part.from_text(text=h["text"])])
            for h in build_history(messages, limit)]


# ---------- tool ----------

def tool_declaration_dict() -> dict:
    """Plain dict form of the run_sensitivity function declaration."""
    return {
        "name": "run_sensitivity",
        "description": (
            "Change ONE input of the student's current plan and return the "
            "finance engine's before, after and change values. Use this for "
            "every what-if question."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string",
                    "enum": list(TOOL_FIELDS),
                    "description": "Input to change: " + "; ".join(
                        f"{k} = {v}" for k, v in TOOL_FIELDS.items()),
                },
                "new_value": {
                    "type": "number",
                    "description": ("New value. Rates and inflation as decimals "
                                    "(4% = 0.04). Spot in MYR per 1 foreign "
                                    "unit. Months 1 to 36."),
                },
            },
            "required": ["field", "new_value"],
        },
    }


def build_tools() -> list:
    from google.genai import types
    return [types.Tool(function_declarations=[
        types.FunctionDeclaration(**tool_declaration_dict())])]


def run_sensitivity(base: Inputs, field: str, new_value: float) -> dict:
    """Tool implementation: a thin, validated wrapper over finance.sensitivity.

    If a rate is given as a whole percent (e.g. 4 instead of 0.04) it is
    treated as a percent, since no realistic annual rate exceeds 100%.
    """
    if field not in TOOL_FIELDS:
        return {"error": f"Unknown field '{field}'. Allowed: {', '.join(TOOL_FIELDS)}."}
    try:
        value = float(new_value)
    except (TypeError, ValueError):
        return {"error": f"new_value must be a number, got {new_value!r}."}
    if field in RATE_FIELDS and abs(value) > 1:
        value = value / 100
    if field == "months" and not 1 <= value <= 36:
        return {"error": "months must be between 1 and 36."}
    if field in {"spot", "cost_foreign"} and value <= 0:
        return {"error": f"{field} must be positive."}
    return finance.sensitivity(base, field, value)


def execute_tool_call(name: str, args: dict | None, base: Inputs) -> dict:
    """Dispatch a model function call to Python."""
    args = dict(args or {})
    if name == "run_sensitivity":
        return run_sensitivity(base, args.get("field", ""), args.get("new_value"))
    return {"error": f"Unknown tool '{name}'."}


# ---------- API call ----------

@dataclass
class CoachReply:
    text: str
    tool_results: list[dict] = field(default_factory=list)


def make_client(api_key: str):
    from google import genai
    return genai.Client(api_key=api_key)


def ask_coach(messages: list[dict], inputs: Inputs, result: dict,
              client=None, model: str | None = None) -> CoachReply:
    """Send one turn to Gemini, running any tool calls locally in Python."""
    if client is None:
        api_key, cfg_model = get_config()
        if not api_key:
            raise CoachUnavailable("No GEMINI_API_KEY found.")
        model = model or cfg_model
        try:
            client = make_client(api_key)
        except ImportError as exc:
            raise CoachUnavailable("google-genai is not installed.") from exc
    model = model or DEFAULT_MODEL

    from google.genai import types
    config = types.GenerateContentConfig(
        system_instruction=build_system_instruction(inputs, result),
        tools=build_tools(),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )
    contents = build_contents(messages)
    tool_results: list[dict] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.models.generate_content(
            model=model, contents=contents, config=config)
        calls = response.function_calls or []
        if not calls:
            return CoachReply(text=(response.text or "").strip(),
                              tool_results=tool_results)
        contents.append(response.candidates[0].content)
        parts = []
        for call in calls:
            out = execute_tool_call(call.name, call.args, inputs)
            if "error" not in out:
                tool_results.append(out)
            parts.append(types.Part.from_function_response(
                name=call.name, response={"result": out}))
        contents.append(types.Content(role="user", parts=parts))

    return CoachReply(
        text="I ran the numbers but could not finish explaining them. Please try again.",
        tool_results=tool_results,
    )
