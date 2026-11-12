"""Tests for the AI Coach's grounding, tool mapping and API loop (no network)."""

import json
from types import SimpleNamespace

import pytest

import coach
import finance
from finance import SCENARIO_1, SCENARIO_2, Inputs


# ---------- tool mapping ----------

def test_run_sensitivity_matches_finance_sensitivity():
    assert coach.run_sensitivity(SCENARIO_1, "pi_my", 0.04) == \
        finance.sensitivity(SCENARIO_1, "pi_my", 0.04)


@pytest.mark.parametrize("field,value", [
    ("pi_f", 0.05), ("i_my", 0.0501), ("i_f", 0.02),
    ("spot", 6.0), ("months", 24), ("cost_foreign", 30_000),
])
def test_run_sensitivity_matches_for_every_field(field, value):
    assert coach.run_sensitivity(SCENARIO_2, field, value) == \
        finance.sensitivity(SCENARIO_2, field, value)


def test_scenario_2_numbers_via_tool():
    s = coach.run_sensitivity(SCENARIO_1, "pi_my", 0.04)
    assert s["after"]["saving_from_converting_now"] == pytest.approx(2_241.60, abs=0.01)
    assert s["after"]["real_rate_my"] == pytest.approx(-0.0096, abs=1e-4)
    assert s["after"]["verdict"] == "Convert now"


def test_scenario_3_fisher_holds_via_tool():
    s = coach.run_sensitivity(SCENARIO_2, "i_my", 0.0501)
    assert s["after"]["verdict"].startswith("Either")


def test_whole_percent_rate_is_normalised():
    assert coach.run_sensitivity(SCENARIO_1, "pi_my", 4) == \
        finance.sensitivity(SCENARIO_1, "pi_my", 0.04)


@pytest.mark.parametrize("field,value", [
    ("bogus", 1.0), ("pi_my", "abc"), ("months", 40), ("spot", -1),
])
def test_run_sensitivity_rejects_bad_input(field, value):
    assert "error" in coach.run_sensitivity(SCENARIO_1, field, value)


def test_execute_tool_call_dispatch():
    out = coach.execute_tool_call("run_sensitivity",
                                  {"field": "pi_my", "new_value": 0.04}, SCENARIO_1)
    assert out == finance.sensitivity(SCENARIO_1, "pi_my", 0.04)
    assert "error" in coach.execute_tool_call("delete_everything", {}, SCENARIO_1)


def test_tool_declaration_fields_are_real_inputs():
    decl = coach.tool_declaration_dict()
    assert decl["name"] == "run_sensitivity"
    enum = decl["parameters"]["properties"]["field"]["enum"]
    assert set(enum) <= set(Inputs.__dataclass_fields__)
    assert decl["parameters"]["required"] == ["field", "new_value"]
    assert coach.build_tools()  # valid google-genai Tool object


# ---------- prompt building ----------

def test_system_instruction_is_grounded_in_engine_json():
    r = finance.compute(SCENARIO_1)
    text = coach.build_system_instruction(SCENARIO_1, r)
    assert "ONLY numbers" in text
    assert "not a licensed advisor" in text
    assert "illustrative" in text.lower()
    data = json.loads(text.split("PLAN DATA (from finance.py):\n", 1)[1])
    assert data["result"]["pv_convert_later"] == 114_873.79
    assert data["inputs"]["spot"] == 5.80


def test_history_keeps_last_10_maps_roles_and_skips_errors():
    msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"}
            for i in range(14)]
    msgs.append({"role": "assistant", "content": "offline", "error": True})
    h = coach.build_history(msgs)
    assert len(h) == 10
    assert h[0] == {"role": "user", "text": "m4"}
    assert h[-1] == {"role": "model", "text": "m13"}
    assert all(x["text"] != "offline" for x in h)


# ---------- config ----------

def test_get_config_prefers_secrets_then_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "env-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    assert coach.get_config({}) == ("env-key", coach.DEFAULT_MODEL)
    assert coach.get_config({"GEMINI_API_KEY": "s-key", "GEMINI_MODEL": "m"}) == ("s-key", "m")


def test_ask_coach_without_key_raises(monkeypatch):
    monkeypatch.setattr(coach, "get_config", lambda secrets=None: (None, "m"))
    with pytest.raises(coach.CoachUnavailable):
        coach.ask_coach([{"role": "user", "content": "hi"}], SCENARIO_1,
                        finance.compute(SCENARIO_1))


# ---------- API loop with a fake client ----------

class FakeModels:
    """First reply asks for a tool call, second reply is plain text."""

    def __init__(self):
        self.calls = []

    def generate_content(self, model, contents, config):
        self.calls.append(list(contents))
        if len(self.calls) == 1:
            fc = SimpleNamespace(name="run_sensitivity",
                                 args={"field": "pi_my", "new_value": 0.04})
            from google.genai import types
            content = types.Content(role="model", parts=[types.Part(
                function_call=types.FunctionCall(name=fc.name, args=fc.args))])
            return SimpleNamespace(function_calls=[fc], text=None,
                                   candidates=[SimpleNamespace(content=content)])
        return SimpleNamespace(function_calls=None, text="Convert now (PPP).",
                               candidates=[])


def test_ask_coach_runs_tool_in_python_and_returns_result():
    fake = SimpleNamespace(models=FakeModels())
    reply = coach.ask_coach([{"role": "user", "content": "What if inflation is 4%?"}],
                            SCENARIO_1, finance.compute(SCENARIO_1),
                            client=fake, model="test-model")
    assert reply.text == "Convert now (PPP)."
    assert reply.tool_results == [finance.sensitivity(SCENARIO_1, "pi_my", 0.04)]
    # second request carried the function response back to the model
    last = fake.models.calls[1][-1]
    assert last.parts[0].function_response.name == "run_sensitivity"
