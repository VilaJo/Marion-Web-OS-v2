"""Unit tests for services/env_local_data_path.py"""

import json
from pathlib import Path

from services.env_local_data_path import (
    read_data_path_from_env_file,
    set_or_remove_data_path_in_env_file,
)


def test_read_missing_file(tmp_path: Path):
    assert read_data_path_from_env_file(tmp_path / ".env.local") is None


def test_merge_into_existing_env(tmp_path: Path):
    f = tmp_path / ".env.local"
    f.write_text("FOO=1\n# comment\nBAR=2\n", encoding="utf-8")
    set_or_remove_data_path_in_env_file(f, "/Users/example/Marion Data")
    text = f.read_text(encoding="utf-8")
    assert "FOO=1" in text
    assert "BAR=2" in text
    assert "DATA_PATH=" in text
    got = read_data_path_from_env_file(f)
    assert got == "/Users/example/Marion Data"


def test_json_encoded_line_roundtrip(tmp_path: Path):
    f = tmp_path / ".env.local"
    set_or_remove_data_path_in_env_file(f, "/Users/x/spaces okay")
    line = next(ln for ln in f.read_text(encoding="utf-8").splitlines() if ln.startswith("DATA_PATH="))
    val = line.split("=", 1)[1]
    assert json.loads(val) == "/Users/x/spaces okay"
    assert read_data_path_from_env_file(f) == "/Users/x/spaces okay"


def test_replace_first_data_path_only(tmp_path: Path):
    f = tmp_path / ".env.local"
    f.write_text('DATA_PATH="/old/path"\nDATA_PATH=/ignored\n', encoding="utf-8")
    set_or_remove_data_path_in_env_file(f, "/new/path")
    lines = [ln for ln in f.read_text(encoding="utf-8").splitlines() if ln.startswith("DATA_PATH")]
    assert len(lines) == 1
    assert read_data_path_from_env_file(f) == "/new/path"


def test_remove_data_path(tmp_path: Path):
    f = tmp_path / ".env.local"
    f.write_text("FOO=1\nDATA_PATH=/x\n", encoding="utf-8")
    set_or_remove_data_path_in_env_file(f, None)
    assert read_data_path_from_env_file(f) is None
    body = f.read_text(encoding="utf-8")
    assert "DATA_PATH" not in body
    assert "FOO=1" in body


def test_remove_noop_when_missing(tmp_path: Path):
    set_or_remove_data_path_in_env_file(tmp_path / ".env.local", None)
