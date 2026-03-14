"""
Tests for Meeting Copilot backend endpoints.
"""


class TestMeetingAnalyzeEndpoint:
    def test_requires_transcription(self, client, auth_headers):
        resp = client.post('/api/v1/meeting/analyze', json={"clientName": "Acme", "consentAccepted": True}, headers=auth_headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data

    def test_requires_consent(self, client, auth_headers):
        resp = client.post(
            '/api/v1/meeting/analyze',
            json={"clientName": "Acme", "rawTranscription": "hello"},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        data = resp.get_json()
        assert "Consentement" in data.get("error", "")

    def test_returns_validated_report_shape(self, client, monkeypatch, auth_headers):
        def fake_generate_json_with_fallback(**_kwargs):
            return {
                "summary": "Réunion productive avec validation du scope.",
                "keyPoints": ["Validation du périmètre", "Budget confirmé"],
                "decisions": ["Démarrage lundi"],
                "risks": ["Retard design si assets absents"],
                "objections": [],
                "nextSteps": ["Envoyer planning", "Créer ticket backlog"],
                "tasks": [
                    {"title": "Envoyer planning", "owner": "Marion", "deadline": "2026-02-20", "priority": "High"},
                    {"title": "Créer backlog", "owner": "Client"},
                ],
                "coachingMoments": [{"timestampSec": 45, "cue": "Clarifier l'objectif principal"}],
                "transcriptExcerpt": "Extrait propre",
                "subject": "Compte-rendu réunion",
                "body": "Bonjour,\nvoici le recap.",
            }

        monkeypatch.setattr('api.ai_bp.generate_json_with_fallback', fake_generate_json_with_fallback)

        resp = client.post(
            '/api/v1/meeting/analyze',
            data={
                "clientName": "Acme",
                "rawTranscription": "On valide le planning et le budget.",
                "durationSeconds": "1200",
                "ai_mode": "local",
                "consentAccepted": "true",
                "retentionDays": "30",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["clientName"] == "Acme"
        assert isinstance(data["summary"], str) and data["summary"]
        assert isinstance(data["keyPoints"], list)
        assert isinstance(data["tasks"], list)
        assert data["tasks"][0]["priority"] in ("Low", "Medium", "High")
        assert data["consentAccepted"] is True
        assert isinstance(data.get("followUpDraft"), str)


class TestMeetingCoachEndpoint:
    def test_coach_returns_normalized_cues(self, client, monkeypatch, auth_headers):
        def fake_generate_json_with_fallback(**_kwargs):
            return {
                "cues": [
                    {"cue": "Demande le critère de succès principal", "rationale": "Aligner la suite", "priority": "high"},
                    {"cue": "Valide qui décide côté client", "priority": "MEDIUM"},
                    {"cue": "Propose un prochain jalon daté", "priority": "low"},
                    {"cue": "Ce 4e cue doit être ignoré"},
                ]
            }

        monkeypatch.setattr('api.ai_bp.generate_json_with_fallback', fake_generate_json_with_fallback)

        resp = client.post(
            '/api/v1/meeting/coach',
            json={
                "transcript": "On discute budget, planning, et go-live.",
                "objective": "obtenir go de lancement",
                "ai_mode": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "cues" in data
        assert len(data["cues"]) == 3
        assert data["cues"][0]["priority"] == "high"

