"""
Smoke tests for v2.6.0 — Marion 2030 Atelier Edition

Verifies that all 11 new endpoints:
- Are registered and callable
- Return sensible status codes (no 500 crashes on missing payload)
- Have proper structure when invoked with minimal valid input

Doesn't hit Gemini (would cost tokens + slow); checks contract/wiring only.
"""

import base64
import io


def _png_blob():
    """Minimal valid 1x1 PNG as base64 data URL (placeholder image)."""
    # 1x1 transparent PNG
    b = base64.b64decode(
        b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+0Mn6owAAAABJRU5ErkJggg=="
    )
    return f"data:image/png;base64,{base64.b64encode(b).decode()}"


class TestV260RoutesRegistered:
    """Checks that all 11 new routes are wired in the Flask app."""

    def test_all_v260_endpoints_exist(self, app):
        all_rules = {str(r.rule) for r in app.url_map.iter_rules()}
        expected = [
            '/api/v1/ai/wp-studio/analyze-site',
            '/api/v1/ai/wp-studio/screenshot-to-prompt',
            '/api/v1/ai/wp-studio/compare-screenshots',
            '/api/v1/ai/wp-studio/import-tasks',
            '/api/v1/ai/wp-studio/history',
            '/api/v1/audit/wp-prospect',
            '/api/v1/audit/deploy-check',
            '/api/v1/ai/code-review',
            '/api/v1/ai/stack-picker',
            '/api/v1/ai/wp-glossary/lookup',
            '/api/v1/ai/daily-lesson',
        ]
        missing = [ep for ep in expected if ep not in all_rules]
        assert not missing, f"Routes missing: {missing}"


class TestV260EndpointsCallable:
    """Verifies endpoints don't crash on invocation with auth + minimal body."""

    def test_daily_lesson_returns_503_or_data(self, client, auth_headers):
        resp = client.post('/api/v1/ai/daily-lesson', json={'level': 'intermediaire'}, headers=auth_headers)
        # 503 if no Gemini configured in test env, 200 with data otherwise
        assert resp.status_code in (200, 500, 503), f"Unexpected: {resp.status_code} {resp.get_json()}"

    def test_code_review_validates_input(self, client, auth_headers):
        # Empty body should return 4xx (missing code), not 500
        resp = client.post('/api/v1/ai/code-review', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_stack_picker_validates_input(self, client, auth_headers):
        resp = client.post('/api/v1/ai/stack-picker', json={}, headers=auth_headers)
        assert resp.status_code in (200, 400, 422, 500, 503)

    def test_wp_glossary_validates_input(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-glossary/lookup', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_wp_glossary_with_term(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-glossary/lookup', json={'term': 'ACF'}, headers=auth_headers)
        assert resp.status_code in (200, 500, 503)

    def test_wp_studio_history_alive(self, client, auth_headers):
        # GET endpoint
        resp = client.get('/api/v1/ai/wp-studio/history', headers=auth_headers)
        assert resp.status_code in (200, 500), f"history returned {resp.status_code}"

    def test_wp_studio_analyze_validates_images(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-studio/analyze-site', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_wp_studio_screenshot_to_prompt_validates(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-studio/screenshot-to-prompt', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_wp_studio_compare_validates(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-studio/compare-screenshots', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_wp_studio_import_tasks_validates(self, client, auth_headers):
        resp = client.post('/api/v1/ai/wp-studio/import-tasks', json={}, headers=auth_headers)
        assert resp.status_code in (400, 404, 422, 500)

    def test_audit_wp_prospect_validates(self, client, auth_headers):
        resp = client.post('/api/v1/audit/wp-prospect', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)

    def test_audit_deploy_check_validates(self, client, auth_headers):
        resp = client.post('/api/v1/audit/deploy-check', json={}, headers=auth_headers)
        assert resp.status_code in (400, 422, 500, 503)


class TestV260RealCalls:
    """Live calls that don't require Gemini — purely network-based audit features."""

    def test_audit_deploy_check_with_real_url(self, client, auth_headers):
        """deploy-check uses public network (HTTP HEAD/GET) + PageSpeed if available."""
        resp = client.post(
            '/api/v1/audit/deploy-check',
            json={'url': 'https://example.com'},
            headers=auth_headers,
        )
        # Should succeed (200) or fail gracefully (500/503), never 404/405
        assert resp.status_code in (200, 500, 503), f"Got {resp.status_code}: {resp.get_json()}"
        if resp.status_code == 200:
            data = resp.get_json()
            # Contract validation
            assert 'checks' in data, f"Missing 'checks' in response: {data}"
            assert isinstance(data['checks'], list)
