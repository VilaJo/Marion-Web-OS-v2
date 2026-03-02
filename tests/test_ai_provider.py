"""
Tests for AI provider routing configuration/status.
"""

from services.gemini_service import resolve_ai_prefs


class TestAiPrefs:
    def test_defaults_are_valid(self):
        prefs = resolve_ai_prefs({})
        assert prefs["ai_mode"] in ("local", "cloud", "hybrid")
        assert isinstance(prefs["local_model"], str)
        assert isinstance(prefs["fallback_enabled"], bool)

    def test_invalid_mode_falls_back_to_default(self):
        prefs = resolve_ai_prefs({"ai_mode": "invalid-mode"})
        assert prefs["ai_mode"] in ("local", "cloud", "hybrid")

    def test_explicit_values_are_respected(self):
        prefs = resolve_ai_prefs({
            "ai_mode": "local",
            "local_model": "qwen2.5:7b-instruct",
            "fallback_enabled": False,
        })
        assert prefs["ai_mode"] == "local"
        assert prefs["local_model"] == "qwen2.5:7b-instruct"
        assert prefs["fallback_enabled"] is False


class TestAiStatusEndpoint:
    def test_check_status_returns_provider_fields(self, client):
        resp = client.get('/api/v1/ai/check-status')
        assert resp.status_code == 200
        data = resp.get_json()
        assert "configured" in data
        assert "provider" in data
        assert "localAvailable" in data
        assert "fallbackEnabled" in data
