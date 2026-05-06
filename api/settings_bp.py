"""
Settings persisted on disk (e.g. DATA_PATH via .env.local).
"""

from __future__ import annotations

from pathlib import Path

from flask import Blueprint, request, jsonify

from services.logger import get_logger
from services.env_local_data_path import (
    read_data_path_from_env_file,
    set_or_remove_data_path_in_env_file,
    validate_client_data_path,
)
from config import get_application_root
from api.shared import error_response, DESKTOP_PATH

logger = get_logger("api.settings")

settings_bp = Blueprint("settings", __name__, url_prefix="/api/v1/settings")


def _env_local_path() -> Path:
    return get_application_root() / ".env.local"


def _resolved_saved_path_hint(raw: str | None) -> str | None:
    if not raw:
        return None
    ok, _, p = validate_client_data_path(raw)
    if not ok:
        return None
    return str(p)


@settings_bp.route("/client-data-path", methods=["GET"])
def get_client_data_path_setting():
    """Paths for UI: what's on disk (.env.local) vs what the running server uses."""
    try:
        env_path = _env_local_path()
        raw_saved = read_data_path_from_env_file(env_path)
        saved_resolved = _resolved_saved_path_hint(raw_saved)
        effective = str(DESKTOP_PATH.resolve())
        return jsonify({
            "envLocalRelative": ".env.local",
            "envLocalAbsolute": str(env_path.resolve()),
            "savedRaw": raw_saved,
            "savedResolved": saved_resolved,
            "effectiveNow": effective,
            "restartRequiredHint": (
                "Redémarre Marion (quitte puis relance le serveur Python) pour appliquer un changement dans .env.local."
            ),
        })
    except Exception as e:
        return error_response(e)


@settings_bp.route("/client-data-path", methods=["POST"])
def set_client_data_path():
    """Write DATA_PATH to project .env.local. Requires restart to apply."""
    body = request.get_json(silent=True) or {}
    reset = bool(body.get("reset"))

    env_path = _env_local_path()

    try:
        if reset:
            set_or_remove_data_path_in_env_file(env_path, None)
            logger.info("Removed DATA_PATH from .env.local")
            return jsonify({
                "success": True,
                "reset": True,
                "message": "DATA_PATH retiré de .env.local. Au prochain démarrage, la valeur par défaut sera utilisée.",
                "restartRequired": True,
            })

        path_in = body.get("path")
        if not isinstance(path_in, str):
            return jsonify({"error": "Champ « path » (texte) requis, ou bien « reset »: true."}), 400

        ok, err, resolved = validate_client_data_path(path_in)
        if not ok:
            return jsonify({"error": err}), 400

        set_or_remove_data_path_in_env_file(env_path, str(resolved))
        logger.info("Wrote DATA_PATH=%s to .env.local", resolved)

        return jsonify({
            "success": True,
            "pathWritten": str(resolved),
            "message": (
                "Chemin enregistré dans .env.local. Redémarre Marion pour que le tableau de bord utilise ce dossier."
            ),
            "restartRequired": True,
        })
    except Exception as e:
        return error_response(e)
