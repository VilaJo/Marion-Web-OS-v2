"""
Persist DATA_PATH in the project's .env.local file (next server start picks it up).
"""

from __future__ import annotations

import re
import sys
import json
from pathlib import Path

DATA_PATH_KEY = "DATA_PATH"


def read_data_path_from_env_file(env_file: Path) -> str | None:
    if not env_file.is_file():
        return None
    try:
        text = env_file.read_text(encoding="utf-8")
    except OSError:
        return None
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        m = re.match(r"^DATA_PATH\s*=\s*(.*)$", s)
        if m:
            val_raw = m.group(1).strip()
            if val_raw.startswith('"'):
                try:
                    parsed = json.loads(val_raw)
                    return str(parsed) if parsed is not None else None
                except json.JSONDecodeError:
                    pass
            val = val_raw.strip('"').strip("'")
            return val or None
    return None


def set_or_remove_data_path_in_env_file(env_file: Path, new_value: str | None) -> None:
    """
    Merge DATA_PATH into env_file. new_value None → remove all DATA_PATH assignments.
    Creates env_file if needed (when setting a value).
    """
    key_re = re.compile(r"^\s*DATA_PATH\s*=")

    if new_value is None:
        if not env_file.is_file():
            return
        lines = env_file.read_text(encoding="utf-8").splitlines()
        kept = [ln for ln in lines if not key_re.match(ln)]
        env_file.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")
        return

    line_out = f"{DATA_PATH_KEY}={json.dumps(new_value)}"
    if env_file.is_file():
        lines = env_file.read_text(encoding="utf-8").splitlines()
        out: list[str] = []
        replaced = False
        for ln in lines:
            if key_re.match(ln):
                if not replaced:
                    out.append(line_out)
                    replaced = True
            else:
                out.append(ln)
        if not replaced:
            if out and out[-1].strip():
                out.append("")
            out.append(line_out)
        env_file.write_text("\n".join(out) + "\n", encoding="utf-8")
    else:
        env_file.parent.mkdir(parents=True, exist_ok=True)
        env_file.write_text(line_out + "\n", encoding="utf-8")


def validate_client_data_path(raw: str) -> tuple[bool, str, Path]:
    """
    Return (ok, error_message, resolved_path).
    Allowed: existing directory, or non-existing path whose parent is an existing directory.
    macOS: must be under /Users/ or /Volumes/ (external disk).
    """
    raw = (raw or "").strip()
    if not raw:
        return False, "Chemin vide.", Path()

    p = Path(raw).expanduser()
    if not p.is_absolute():
        p = (Path.home() / p).resolve()
    else:
        p = p.resolve()

    s = str(p)
    if sys.platform == "darwin":
        if not (s.startswith("/Users/") or s.startswith("/Volumes/")):
            return (
                False,
                "Pour la sécurité, choisis un dossier dans /Users/… ou sur un disque externe (/Volumes/…).",
                p,
            )
    else:
        if not s.startswith(str(Path.home().resolve())):
            return (
                False,
                "Pour la sécurité, le dossier doit être sous ton répertoire personnel.",
                p,
            )

    if p.exists():
        if not p.is_dir():
            return False, "Ce chemin existe mais n'est pas un dossier.", p
        return True, "", p

    if p.parent.is_dir():
        return True, "", p

    return False, "Le dossier parent n'existe pas — crée-le d'abord dans le Finder.", p
