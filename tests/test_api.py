"""Tests for the FastAPI backend. Skipped if FastAPI is not installed."""

import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

import coach  # noqa: E402
import finance  # noqa: E402
from backend import main  # noqa: E402
from backend.schemas import InputsModel  # noqa: E402
from finance import SCENARIO_1  # noqa: E402

client = TestClient(main.app)
S1 = InputsModel.from_inputs(SCENARIO_1).model_dump()


@pytest.fixture
def no_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def test_health(no_key):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["coach_available"] is False


def test_presets_include_destinations_and_scenarios():
    data = client.get("/api/presets").json()
    assert set(data["destinations"]) == {"GBP", "AUD", "USD"}
    assert data["destinations"]["GBP"]["inputs"] == S1
    assert set(data["scenarios"]) == {"2", "3", "4"}


def test_compute_reproduces_scenario_1():
    r = client.post("/api/compute", json=S1)
    assert r.status_code == 200
    res = r.json()["result"]
    assert res == finance.compute(SCENARIO_1)
    assert res["pv_convert_later"] == 114_873.79
    assert res["pv_convert_now"] == 114_884.62
    assert res["verdict"].startswith("Either")
    assert len(r.json()["cost_path"]) == 13


@pytest.mark.parametrize("bad", [{"months": 0}, {"months": 40}, {"spot": -1},
                                 {"i_my": 3}, {"unknown": 1}])
def test_compute_rejects_bad_inputs(bad):
    assert client.post("/api/compute", json=S1 | bad).status_code == 422


def test_sensitivity_matches_engine():
    r = client.post("/api/sensitivity",
                    json={"inputs": S1, "field": "pi_my", "new_value": 0.04})
    assert r.status_code == 200
    assert r.json() == finance.sensitivity(SCENARIO_1, "pi_my", 0.04)


def test_sensitivity_rejects_out_of_range_value():
    r = client.post("/api/sensitivity",
                    json={"inputs": S1, "field": "months", "new_value": 99})
    assert r.status_code == 422


@pytest.mark.parametrize("sid,verdict", [("2", "Convert now"), ("3", "Either"),
                                         ("4", "Convert later")])
def test_preset_scenarios_give_each_verdict(sid, verdict):
    s = client.get(f"/api/scenarios/{sid}").json()["sensitivity"]
    assert s["after"]["verdict"].startswith(verdict)


def test_scenario_2_numbers():
    s = client.get("/api/scenarios/2").json()["sensitivity"]["after"]
    assert s["saving_from_converting_now"] == pytest.approx(2_241.60, abs=0.01)
    assert s["real_rate_my"] == pytest.approx(-0.0096, abs=1e-4)


def test_unknown_scenario_404():
    assert client.get("/api/scenarios/9").status_code == 404


def test_chat_without_key_returns_503(no_key):
    r = client.post("/api/chat", json={
        "inputs": S1, "messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503


def test_chat_with_stubbed_coach(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(coach, "make_client", lambda key: object())

    def fake_ask(messages, inputs, result, client=None, model=None):
        assert result == finance.compute(SCENARIO_1)     # grounded in the engine
        assert messages[-1]["content"] == "What if inflation is 4%?"
        return coach.CoachReply(
            text="Convert now (PPP).",
            tool_results=[coach.run_sensitivity(inputs, "pi_my", 0.04)])

    monkeypatch.setattr(coach, "ask_coach", fake_ask)
    r = client.post("/api/chat", json={
        "inputs": S1,
        "messages": [{"role": "user", "content": "What if inflation is 4%?"}]})
    assert r.status_code == 200
    body = r.json()
    assert body["reply"] == "Convert now (PPP)."
    assert body["tool_results"][0] == finance.sensitivity(SCENARIO_1, "pi_my", 0.04)


def test_chat_api_failure_returns_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(coach, "make_client", lambda key: object())

    def boom(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr(coach, "ask_coach", boom)
    r = client.post("/api/chat", json={
        "inputs": S1, "messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 502
