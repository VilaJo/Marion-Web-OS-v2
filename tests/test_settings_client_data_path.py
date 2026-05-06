"""Tests for /api/v1/settings/client-data-path"""

import os
import shutil
from pathlib import Path

from services.env_local_data_path import read_data_path_from_env_file


class TestSettingsClientDataPath:
    """API routes persist DATA_PATH in project `.env.local` (path monkeypatched for tests)."""

    def test_get_returns_shape(self, client, auth_headers, monkeypatch, tmp_path):
        monkeypatch.setattr("api.settings_bp.get_application_root", lambda: tmp_path)
        resp = client.get("/api/v1/settings/client-data-path", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "envLocalAbsolute" in data
        assert "effectiveNow" in data
        assert "savedRaw" in data

    def test_post_writes_under_project_root(self, client, auth_headers, monkeypatch, tmp_path):
        data_root = Path.home() / f".marion_test_cdpath_{os.getpid()}"
        data_root.mkdir(parents=True, exist_ok=True)
        try:
            monkeypatch.setattr("api.settings_bp.get_application_root", lambda: tmp_path)
            resp = client.post(
                "/api/v1/settings/client-data-path",
                headers={**auth_headers, "Content-Type": "application/json"},
                json={"path": str(data_root)},
            )
            assert resp.status_code == 200
            j = resp.get_json()
            assert j.get("success") is True
            assert j.get("restartRequired") is True

            env_local = tmp_path / ".env.local"
            assert env_local.is_file()
            assert read_data_path_from_env_file(env_local) == str(data_root.resolve())
        finally:
            shutil.rmtree(data_root, ignore_errors=True)

    def test_post_invalid_path(self, client, auth_headers, monkeypatch, tmp_path):
        monkeypatch.setattr("api.settings_bp.get_application_root", lambda: tmp_path)
        resp = client.post(
            "/api/v1/settings/client-data-path",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"path": "/nope/definitely/not/under/home/xyz123"},
        )
        assert resp.status_code == 400

    def test_post_reset(self, client, auth_headers, monkeypatch, tmp_path):
        env_local = tmp_path / ".env.local"
        env_local.write_text('DATA_PATH="/tmp/example"\n', encoding="utf-8")
        monkeypatch.setattr("api.settings_bp.get_application_root", lambda: tmp_path)
        resp = client.post(
            "/api/v1/settings/client-data-path",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={"reset": True},
        )
        assert resp.status_code == 200
        assert read_data_path_from_env_file(env_local) is None
