"""
coach.py - grounded AI Coach for StudyAbroad Ringgit Coach.

Design rule: finance.py computes every number. The AI model (Gemini, with
Claude as an optional backup) only EXPLAINS the numbers it is given (the
current compute() result as JSON) or the numbers returned by the
run_sensitivity tool, which runs finance.sensitivity in Python.

Prompt building, the tool definition, tool execution and the API call are
kept in separate functions so they can be unit tested without the API.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from typing import Any

import finance
from finance import Inputs

DEFAULT_MODEL = "gemini-3.8-flash"
# Tried in order after the chosen model when Gemini is busy or slow.
FALLBACK_MODELS = ("gemini-3.8-flash", "gemini-3.6-flash")
# Google can take ~30 s just to say "busy", so each model gets one try with a
# time limit, then the next model (and finally Claude) takes over.
RETRIES_PER_MODEL = 1
REQUEST_TIMEOUT_MS = 20_000

# Claude is used only when every Gemini model fails and ANTHROPIC_API_KEY is set.
DEFAULT_CLAUDE_MODEL = "claude-opus-5-5"
CLAUDE_MAX_TOKENS = 16_000
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
- Money format: RM with 2 decimals (e.g. RM114,873.79; negative amounts as -RM10.83, never RM-10.83); foreign amounts with the currency code first and thousands separators (GBP 20,600.00); exchange rates with 4 decimals; percents with 2 decimals.
- Never show JSON field names such as pv_convert_later or real_rate_my. Describe them in plain words (e.g. "the cost of converting later in today's money").
- Show rates as percentages only (0.98%), never as raw decimals like 0.009804.
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


def get_claude_config(secrets: Any = None) -> tuple[str | None, str]:
    """Return (api_key, model) for the Claude backup. Same lookup order."""
    if secrets is None:
        try:
            import streamlit as st
            secrets = st.secrets
        except Exception:
            secrets = {}

    def _read(name: str) -> str | None:
        try:
            value = secrets.get(name) if secrets is not None else None
        except Exception:
            value = None
        return value or os.environ.get(name)

    return _read("ANTHROPIC_API_KEY"), _read("ANTHROPIC_MODEL") or DEFAULT_CLAUDE_MODEL


# ---------- prompt building ----------

def build_plan_json(inputs: Inputs, result: dict) -> str:
    """Current inputs and engine result as the JSON the model is grounded on."""
    return json.dumps(
        {"inputs": asdict(inputs), "result": result,
         "note": "Illustrative data, not current market rates."},
        indent=2,
    )


LANGUAGE_INSTRUCTIONS = {
    "en": "",
    "ms": (
        "\n\nLANGUAGE: Reply ONLY in Bahasa Melayu (Malaysia), in simple everyday words a "
        "university student would use. Do not use English theory names. Always write the "
        "theories exactly as: Pariti Kuasa Beli (PPP), Pariti Kadar Faedah (IRP), "
        "Kesan Fisher, Kesan Fisher Antarabangsa (IFE). Present value is 'nilai kini', "
        "real interest rate is 'kadar faedah benar'. Say 'tukar sekarang' for convert "
        "now, 'tukar kemudian' for convert later and 'mana-mana pun' for either. Keep "
        "numbers exactly as given (RM114,873.79 style). To decline, say: \"Saya alat "
        "pembelajaran, bukan penasihat kewangan berlesen.\" Say the data is ilustrasi, "
        "bukan kadar pasaran semasa."
    ),
}


def build_system_instruction(inputs: Inputs, result: dict, language: str = "en") -> str:
    # The language rule goes first and is repeated last: models follow it more reliably.
    lang_rule = LANGUAGE_INSTRUCTIONS.get(language, "").strip()
    head = f"{lang_rule}\n\n" if lang_rule else ""
    tail = f"\n\nREMINDER: {lang_rule}" if lang_rule else ""
    return (f"{head}{SYSTEM_INSTRUCTION}{tail}"
            f"\n\nPLAN DATA (from finance.py):\n{build_plan_json(inputs, result)}")


# Deterministic clean-up of the model's wording. It never changes a number.
_MS_TERMS = [  # longest first, so "International Fisher Effect" wins over "Fisher Effect"
    ("International Fisher Effect", "Kesan Fisher Antarabangsa"),
    ("Purchasing Power Parity", "Pariti Kuasa Beli"),
    ("Interest Rate Parity", "Pariti Kadar Faedah"),
    ("Fisher Effect", "Kesan Fisher"),
    ("Convert now", "Tukar sekarang"),
    ("Convert later", "Tukar kemudian"),
]


def polish_reply(text: str, language: str = "en") -> str:
    """Fix money sign format (RM-10.83 -> -RM10.83) and, for Malay, English theory names."""
    text = re.sub(r"RM-(?=\d)", "-RM", text)
    if language == "ms":
        for en_term, ms_term in _MS_TERMS:
            text = re.sub(re.escape(en_term), ms_term, text, flags=re.IGNORECASE)
            # "(Purchasing Power Parity / Pariti Kuasa Beli)" would now read twice
            text = re.sub(rf"{re.escape(ms_term)}\s*/\s*{re.escape(ms_term)}", ms_term, text)
    return text


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
    model: str | None = None      # which model actually answered


def make_client(api_key: str):
    from google import genai
    from google.genai import types
    return genai.Client(api_key=api_key,
                        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS))


def is_transient(exc: Exception) -> bool:
    """True for errors worth retrying: busy model, rate limit, server error, timeout."""
    code = getattr(exc, "code", None)
    if code in (429, 500, 502, 503, 504):
        return True
    name = type(exc).__name__.lower()
    return "timeout" in name or "connect" in name


def generate_with_fallback(client, model: str, contents, config):
    """Call Gemini, retrying busy errors and then trying the backup models.

    Returns (response, model_used). Errors that are not transient (bad key,
    bad request) are raised straight away.
    """
    import time
    models = [model] + [m for m in FALLBACK_MODELS if m != model]
    last: Exception | None = None
    for m in models:
        for attempt in range(RETRIES_PER_MODEL):
            try:
                return client.models.generate_content(
                    model=m, contents=contents, config=config), m
            except Exception as exc:
                if not is_transient(exc) and getattr(exc, "code", None) != 404:
                    raise
                last = exc
                if getattr(exc, "code", None) == 404:
                    break  # model not available: go to the next one
                if attempt + 1 < RETRIES_PER_MODEL:
                    time.sleep(1.0 * (attempt + 1))
    raise last if last else RuntimeError("No Gemini model available.")


def ask_coach(messages: list[dict], inputs: Inputs, result: dict,
              client=None, model: str | None = None, language: str = "en") -> CoachReply:
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
        system_instruction=build_system_instruction(inputs, result, language),
        tools=build_tools(),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )
    contents = build_contents(messages)
    tool_results: list[dict] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response, model = generate_with_fallback(client, model, contents, config)
        calls = response.function_calls or []
        if not calls:
            return CoachReply(text=polish_reply((response.text or "").strip(), language),
                              tool_results=tool_results, model=model)
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


# ---------- Claude backup ----------

def make_claude_client(api_key: str):
    import anthropic
    # Claude is the last resort, so give it more time than one Gemini try.
    return anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=1)


def claude_tool() -> dict:
    """run_sensitivity in the Anthropic tool format (same schema as Gemini's)."""
    d = tool_declaration_dict()
    return {"name": d["name"], "description": d["description"],
            "input_schema": d["parameters"]}


def build_claude_messages(messages: list[dict], limit: int = MAX_HISTORY) -> list[dict]:
    """Chat history in Anthropic format. The first message must be from the user."""
    out = [{"role": "assistant" if h["role"] == "model" else "user", "content": h["text"]}
           for h in build_history(messages, limit)]
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out


def ask_claude(messages: list[dict], inputs: Inputs, result: dict,
               client=None, model: str | None = None, language: str = "en") -> CoachReply:
    """Send one turn to Claude, running any tool calls locally in Python."""
    if client is None:
        api_key, cfg_model = get_claude_config()
        if not api_key:
            raise CoachUnavailable("No ANTHROPIC_API_KEY found.")
        model = model or cfg_model
        client = make_claude_client(api_key)
    model = model or DEFAULT_CLAUDE_MODEL

    system = build_system_instruction(inputs, result, language)
    convo = build_claude_messages(messages)
    tool_results: list[dict] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.beta.messages.create(
            model=model,
            max_tokens=CLAUDE_MAX_TOKENS,
            system=system,
            tools=[claude_tool()],
            messages=convo,
            output_config={"effort": "low"},          # short chat answers
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            return CoachReply(text="Sorry, I can't help with that. Try asking about "
                                   "your plan's numbers.", tool_results=tool_results,
                              model=response.model)
        if response.stop_reason != "tool_use":
            text = "".join(b.text for b in response.content if b.type == "text").strip()
            return CoachReply(text=polish_reply(text, language),
                              tool_results=tool_results, model=response.model)

        # Keep the full assistant turn (thinking + tool calls) in the history.
        convo.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            out = execute_tool_call(block.name, block.input, inputs)
            if "error" not in out:
                tool_results.append(out)
            item = {"type": "tool_result", "tool_use_id": block.id,
                    "content": json.dumps(out)}
            if "error" in out:
                item["is_error"] = True
            results.append(item)
        convo.append({"role": "user", "content": results})

    return CoachReply(
        text="I ran the numbers but could not finish explaining them. Please try again.",
        tool_results=tool_results, model=model,
    )


def ask_with_backup(messages: list[dict], inputs: Inputs, result: dict,
                    gemini: tuple | None = None, claude: tuple | None = None,
                    language: str = "en") -> CoachReply:
    """Try Gemini first; if it fails and Claude is configured, answer with Claude.

    `gemini` and `claude` are (client, model) pairs, or None when not configured.
    """
    if gemini is None and claude is None:
        raise CoachUnavailable("No GEMINI_API_KEY or ANTHROPIC_API_KEY found.")
    if gemini is not None:
        try:
            return ask_coach(messages, inputs, result, client=gemini[0],
                             model=gemini[1], language=language)
        except Exception:
            if claude is None:
                raise
    return ask_claude(messages, inputs, result, client=claude[0],
                      model=claude[1], language=language)
