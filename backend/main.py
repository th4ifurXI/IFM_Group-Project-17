"""
backend/main.py - FastAPI backend for StudyAbroad Ringgit Coach.

Run from the repo root:
    uvicorn backend.main:app --reload

Interactive docs: http://localhost:8000/docs

This is a thin HTTP layer. Every number still comes from finance.py and the
AI Coach still goes through coach.py, exactly as in the Streamlit app.

Environment variables:
    GEMINI_API_KEY   required for /api/chat only
    GEMINI_MODEL     optional, defaults to coach.DEFAULT_MODEL
    ALLOWED_ORIGINS  comma-separated frontend URLs for CORS
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

import coach
import finance
from scenarios import (DESTINATIONS, ILLUSTRATIVE_LABEL, PRESETS, SCENARIO_1,
                       SCENARIO_2)

from .schemas import (ChatRequest, ChatResponse, InputsModel,
                      SensitivityRequest)

app = FastAPI(
    title="StudyAbroad Ringgit Coach API",
    description="Know when to convert, what it will cost, and why. "
                f"{ILLUSTRATIVE_LABEL}.",
    version="0.1.0",
)

_origins = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Preset what-ifs, one per verdict. Mirrors the Streamlit Sensitivity tab.
PRESET_SCENARIOS = {
    "2": {"title": "Scenario 2: Malaysian inflation rises from 2% to 4%",
          "base": SCENARIO_1, "field": "pi_my", "new_value": 0.04,
          "expected_verdict": "Convert now"},
    "3": {"title": "Scenario 3: Fisher holds (Malaysian rate adjusts to 5.01%)",
          "base": SCENARIO_2, "field": "i_my", "new_value": 0.0501,
          "expected_verdict": "Either"},
    "4": {"title": "Scenario 4: Malaysian interest rate rises from 3% to 5%",
          "base": SCENARIO_1, "field": "i_my", "new_value": 0.05,
          "expected_verdict": "Convert later"},
}


def _coach_config() -> tuple[str | None, str]:
    # Backend reads environment variables only (no Streamlit secrets).
    return coach.get_config({})


@app.get("/api/health")
def health() -> dict:
    api_key, model = _coach_config()
    return {"status": "ok", "coach_available": bool(api_key), "model": model,
            "note": ILLUSTRATIVE_LABEL}


@app.get("/api/presets")
def presets() -> dict:
    return {
        "note": ILLUSTRATIVE_LABEL,
        "default": "GBP",
        "destinations": {
            code: {"name": DESTINATIONS[code],
                   "inputs": InputsModel.from_inputs(p).model_dump()}
            for code, p in PRESETS.items()
        },
        "scenarios": {k: {"title": v["title"],
                          "expected_verdict": v["expected_verdict"]}
                      for k, v in PRESET_SCENARIOS.items()},
    }


@app.post("/api/compute")
def compute(inputs: InputsModel) -> dict:
    x = inputs.to_inputs()
    return {"result": finance.compute(x), "cost_path": finance.cost_path(x),
            "note": ILLUSTRATIVE_LABEL}


@app.post("/api/sensitivity")
def sensitivity(req: SensitivityRequest) -> dict:
    # Validate the changed input with the same rules as any other input.
    changed = req.inputs.model_dump() | {req.field: req.new_value}
    try:
        InputsModel(**changed)
    except ValidationError as exc:
        raise HTTPException(status_code=422,
                            detail=f"new_value out of range for {req.field}") from exc
    value = int(req.new_value) if req.field == "months" else req.new_value
    return finance.sensitivity(req.inputs.to_inputs(), req.field, value)


@app.get("/api/scenarios/{scenario_id}")
def scenario(scenario_id: str) -> dict:
    s = PRESET_SCENARIOS.get(scenario_id)
    if s is None:
        raise HTTPException(status_code=404,
                            detail=f"Unknown scenario. Try {', '.join(PRESET_SCENARIOS)}.")
    return {"title": s["title"],
            "sensitivity": finance.sensitivity(s["base"], s["field"], s["new_value"])}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    api_key, model = _coach_config()
    if not api_key:
        raise HTTPException(status_code=503,
                            detail="The AI Coach is offline: no GEMINI_API_KEY is set.")
    if req.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user.")

    x = req.inputs.to_inputs()
    result = finance.compute(x)
    try:
        reply = coach.ask_coach([m.model_dump() for m in req.messages], x, result,
                                client=coach.make_client(api_key), model=model)
    except Exception as exc:  # network, quota, bad model name
        raise HTTPException(status_code=502,
                            detail=f"Could not reach the AI service ({type(exc).__name__}).") from exc
    return ChatResponse(reply=reply.text, tool_results=reply.tool_results)
