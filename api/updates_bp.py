"""
Updates Blueprint - Version info, update checking and changelog.
Handles: /api/version, /api/updates/check, /api/updates/apply, /api/updates/changelog,
         /api/report-bug
"""

import os
import sys
import threading
from services.logger import get_logger

logger = get_logger('api.updates')
from pathlib import Path
from datetime import datetime
from flask import Blueprint, request, jsonify

from api.shared import error_response

import requests as http_requests  # avoid shadowing flask.request

from config import get_current_config

cfg = get_current_config()

updates_bp = Blueprint('updates', __name__, url_prefix='/api/v1')

APP_VERSION = cfg.APP_VERSION
GITHUB_REPO_API = "https://api.github.com/repos/VilaJo/Marion-Web-OS-v2"


@updates_bp.route('/version')
def get_version():
    """Get current app version."""
    return jsonify({
        "version": APP_VERSION,
        "name": "Marion Web OS",
        "buildDate": datetime.now().strftime("%Y-%m-%d"),
    })


@updates_bp.route('/updates/check')
def check_updates():
    """Check GitHub for new releases."""
    try:
        response = http_requests.get(
            f"{GITHUB_REPO_API}/releases/latest",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            latest_version = data.get("tag_name", "").lstrip("v")

            def version_tuple(v):
                return tuple(map(int, v.split(".")))

            try:
                is_newer = version_tuple(latest_version) > version_tuple(APP_VERSION)
            except Exception:
                is_newer = latest_version != APP_VERSION

            return jsonify({
                "currentVersion": APP_VERSION,
                "latestVersion": latest_version,
                "updateAvailable": is_newer,
                "releaseNotes": data.get("body", ""),
                "releaseName": data.get("name", ""),
                "publishedAt": data.get("published_at", ""),
                "downloadUrl": data.get("zipball_url", ""),
                "htmlUrl": data.get("html_url", ""),
            })
        elif response.status_code == 404:
            commits_response = http_requests.get(
                f"{GITHUB_REPO_API}/commits?per_page=1",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
            if commits_response.status_code == 200:
                commits = commits_response.json()
                if commits:
                    return jsonify({
                        "currentVersion": APP_VERSION,
                        "latestVersion": APP_VERSION,
                        "updateAvailable": False,
                        "message": "Vous utilisez la derniere version.",
                        "lastCommit": commits[0].get("sha", "")[:7] if commits else None,
                    })
            return jsonify({
                "currentVersion": APP_VERSION,
                "latestVersion": APP_VERSION,
                "updateAvailable": False,
                "message": "Aucune release trouvee sur GitHub.",
            })
        else:
            return jsonify({
                "error": f"GitHub API error: {response.status_code}",
                "currentVersion": APP_VERSION,
            }), 500

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
