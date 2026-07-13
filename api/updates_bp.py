"""
Updates Blueprint - Version info, update checking and changelog.
Handles: /api/version, /api/updates/check, /api/updates/apply, /api/updates/changelog,
         /api/report-bug
"""

from __future__ import annotations

import os
import sys
import json
import threading
from services.logger import get_logger

logger = get_logger('api.updates')
from pathlib import Path
from datetime import datetime
from flask import Blueprint, request, jsonify

from api.shared import error_response, DESKTOP_PATH, count_scanned_project_folders

import requests as http_requests  # avoid shadowing flask.request

from config import get_current_config

cfg = get_current_config()

updates_bp = Blueprint('updates', __name__, url_prefix='/api/v1')

_APP_ROOT = Path(__file__).resolve().parent.parent
APP_VERSION = cfg.APP_VERSION
GITHUB_REPO_API = "https://api.github.com/repos/VilaJo/Marion-Web-OS-v2"
BUILD_STAMP_FILE = _APP_ROOT / "BUILD_STAMP.json"
INSTALLED_STAMP_FILE = _APP_ROOT / ".marion_installed.json"


def _read_json_file(path: Path) -> dict | None:
    try:
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _local_install_commit() -> str:
    """Best-effort local commit id (stamp file, install record, or git)."""
    for candidate in (BUILD_STAMP_FILE, INSTALLED_STAMP_FILE):
        data = _read_json_file(candidate)
        if data and isinstance(data.get('commit'), str) and data['commit'].strip():
            return data['commit'].strip()

    git_dir = _APP_ROOT / '.git'
    if git_dir.is_dir():
        import subprocess
        try:
            out = subprocess.check_output(
                ['git', 'rev-parse', 'HEAD'],
                cwd=str(_APP_ROOT),
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
            if out:
                return out
        except Exception:
            pass
    return ''


def _fetch_remote_main_commit() -> tuple[str, str]:
    """Return (full_sha, short_sha) for latest commit on main."""
    response = http_requests.get(
        f"{GITHUB_REPO_API}/commits/main",
        headers={"Accept": "application/vnd.github.v3+json"},
        timeout=10,
    )
    if response.status_code != 200:
        return '', ''
    data = response.json()
    sha = (data.get('sha') or '').strip()
    return sha, sha[:7] if sha else ''


def _commits_differ(local_commit: str, remote_commit: str) -> bool:
    if not remote_commit:
        return False
    if not local_commit:
        return True
    return not (
        local_commit == remote_commit
        or local_commit.startswith(remote_commit)
        or remote_commit.startswith(local_commit)
    )


def _resolved_static_folder() -> str:
    p = Path(cfg.STATIC_FOLDER)
    if not p.is_absolute():
        p = _APP_ROOT / p
    return str(p.resolve())


def _settings_js_mtime_iso() -> str | None:
    """Best-effort: newest mtime among Settings chunk in .dist — proves UI rebuild landed."""
    static_dir = Path(_resolved_static_folder())
    assets = static_dir / "assets"
    if not assets.is_dir():
        return None
    try:
        newest = None
        newest_ts = 0.0
        for f in assets.iterdir():
            if not f.is_file():
                continue
            name = f.name
            if not name.startswith("Settings-") or not name.endswith(".js"):
                continue
            mt = f.stat().st_mtime
            if mt > newest_ts:
                newest_ts = mt
                newest = f
        if newest is None:
            return None
        return datetime.fromtimestamp(newest_ts).strftime("%Y-%m-%d %H:%M")
    except OSError:
        return None


@updates_bp.route('/version')
def get_version():
    """Get current app version and resolved local DATA_PATH (public — same host only in practice).

    Mirrors key fields from GET /projects/workspace so Marion can diagnose missing clients
    even when the session rejects the authenticated workspace route (e.g. token issues).
    """
    root = DESKTOP_PATH.resolve()
    folder_count = count_scanned_project_folders()
    db_str = ""
    try:
        db_str = str(cfg.get_db_path().expanduser().resolve())
    except Exception:
        pass
    return jsonify({
        "version": APP_VERSION,
        "name": "Eonora Tech OS",
        "buildDate": datetime.now().strftime("%Y-%m-%d"),
        "clientDataPath": str(root),
        "clientDataPathExists": root.is_dir(),
        "clientFolderCount": folder_count,
        "sqliteDatabasePath": db_str,
        # Aide support : souvent Marion lance un autre dossier que celui où git pull a été fait.
        "appInstallationRoot": str(_APP_ROOT.resolve()),
        "staticFolderResolved": _resolved_static_folder(),
        "settingsBundleBuiltAt": _settings_js_mtime_iso(),
    })


@updates_bp.route('/updates/check')
def check_updates():
    """Check GitHub main branch + latest release for updates."""
    try:
        local_commit = _local_install_commit()
        local_short = local_commit[:7] if local_commit else ''
        remote_commit, remote_short = _fetch_remote_main_commit()
        commits_behind = _commits_differ(local_commit, remote_commit)

        latest_version = APP_VERSION
        release_notes = ''
        release_name = ''
        published_at = ''
        html_url = ''
        download_url = ''
        version_newer = False

        try:
            response = http_requests.get(
                f"{GITHUB_REPO_API}/releases/latest",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                latest_version = (data.get("tag_name") or APP_VERSION).lstrip("v")
                release_notes = data.get("body", "") or ""
                release_name = data.get("name", "") or ""
                published_at = data.get("published_at", "") or ""
                html_url = data.get("html_url", "") or ""
                download_url = data.get("zipball_url", "") or ""

                def version_tuple(v: str):
                    return tuple(int(x) for x in v.split(".") if x.isdigit())

                try:
                    version_newer = version_tuple(latest_version) > version_tuple(APP_VERSION)
                except Exception:
                    version_newer = latest_version != APP_VERSION
        except Exception as exc:
            logger.warning("release check failed: %s", exc)

        # Stamp version on main may be ahead of release tag
        stamp = _read_json_file(BUILD_STAMP_FILE)
        if stamp and isinstance(stamp.get('version'), str):
            try:
                sv = stamp['version']
                def version_tuple(v: str):
                    return tuple(int(x) for x in v.split(".") if x.isdigit())
                if version_tuple(sv) > version_tuple(APP_VERSION):
                    latest_version = sv
                    version_newer = True
            except Exception:
                pass

        update_available = commits_behind or version_newer

        if update_available:
            message = (
                f"Nouveau code sur GitHub (main {remote_short or '?'})"
                if commits_behind
                else f"Version {latest_version} disponible"
            )
        else:
            message = "Vous êtes synchronisé avec GitHub (branche main)."

        return jsonify({
            "currentVersion": APP_VERSION,
            "latestVersion": latest_version,
            "updateAvailable": update_available,
            "commitsBehind": commits_behind,
            "localCommit": local_short or None,
            "remoteCommit": remote_short or None,
            "releaseNotes": release_notes,
            "releaseName": release_name,
            "publishedAt": published_at,
            "downloadUrl": download_url,
            "htmlUrl": html_url,
            "message": message,
            "syncSource": "github-main",
        })

    except http_requests.exceptions.Timeout:
        return jsonify({
            "error": "Timeout lors de la verification",
            "currentVersion": APP_VERSION,
        }), 504
    except Exception as e:
        return error_response(e)


@updates_bp.route('/updates/apply', methods=['POST'])
def apply_update():
    """Trigger the update script."""
    import subprocess

    try:
        app_dir = Path(__file__).parent.parent
        update_script = app_dir / "METTRE_A_JOUR.command"

        if not update_script.exists():
            return jsonify({"error": "Script de mise a jour introuvable"}), 404

        os.chmod(update_script, 0o755)

        def run_update():
            import time
            time.sleep(2)
            try:
                subprocess.Popen(
                    ['open', str(update_script)],
                    cwd=str(app_dir),
                    start_new_session=True,
                )
            except Exception as e:
                logger.error("Update error: %s", e, exc_info=True)

        update_thread = threading.Thread(target=run_update, daemon=True)
        update_thread.start()

        return jsonify({
            "success": True,
            "message": "Mise a jour en cours... L'application va redemarrer.",
            "instruction": "Le script de mise a jour va s'ouvrir. Suivez les instructions dans le terminal.",
        })
    except Exception as e:
        return error_response(e)


@updates_bp.route('/updates/changelog')
def get_changelog():
    """Get the changelog file."""
    try:
        changelog_path = Path(__file__).parent.parent / "CHANGELOG.md"
        if changelog_path.exists():
            with open(changelog_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({"changelog": content})
        return jsonify({"changelog": "Aucun changelog disponible."})
    except Exception as e:
        return error_response(e)


@updates_bp.route('/report-bug', methods=['POST'])
def report_bug():
    """Report a bug by creating a GitHub issue."""
    if not cfg.GITHUB_TOKEN:
        return jsonify({"error": "Token GitHub non configuré. Ajoutez GITHUB_TOKEN dans .env"}), 503

    data = request.json or {}
    title = data.get('title', '').strip()
    body = data.get('body', '').strip()
    labels = data.get('labels', ['bug', 'user-report'])

    if not title:
        return jsonify({"error": "Le titre est requis"}), 400

    try:
        response = http_requests.post(
            f"{GITHUB_REPO_API}/issues",
            headers={
                "Accept": "application/vnd.github.v3+json",
                "Authorization": f"token {cfg.GITHUB_TOKEN}",
            },
            json={
                "title": title,
                "body": body,
                "labels": labels,
            },
            timeout=15,
        )

        if response.status_code in (200, 201):
            issue = response.json()
            return jsonify({
                "success": True,
                "issueUrl": issue.get("html_url", ""),
                "issueNumber": issue.get("number"),
                "message": f"Issue #{issue.get('number')} créée avec succès.",
            })
        else:
            error_detail = response.json().get("message", response.text)
            return jsonify({"error": f"GitHub API: {error_detail}"}), response.status_code

    except http_requests.exceptions.Timeout:
        return jsonify({"error": "Timeout lors de la création de l'issue GitHub"}), 504
    except Exception as e:
        return error_response(e)
