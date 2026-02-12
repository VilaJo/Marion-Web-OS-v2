"""
Files Blueprint - File management routes
Handles: list, open, create, dispatch, move, rename, delete
"""

import os
import time
import subprocess
import shutil
from pathlib import Path
from flask import Blueprint, request, jsonify

from services.logger import get_logger
from api.shared import (
    DESKTOP_PATH, get_safe_path, init_db_structure,
    STATUS_FOLDER_MAP,
    error_response, validate_json,
)

logger = get_logger('api.files')
files_bp = Blueprint('files', __name__, url_prefix='/api/v1/files')


@files_bp.route('/list', methods=['POST'])
def list_files():
    """List files in a project directory."""
    data = request.json
    path_str = data.get('path', '')
    try:
        target_path = get_safe_path(path_str)
        if not target_path.exists():
            return jsonify({"items": []})
        items = []
        for entry in target_path.iterdir():
            if entry.name.startswith('.') or entry.name == 'Icon\r':
                continue
            items.append({
                "name": entry.name,
                "type": "folder" if entry.is_dir() else "file",
                "path": str(entry.relative_to(target_path))
            })
        items.sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
        return jsonify({"items": items})
    except Exception as e:
        return error_response(e)


@files_bp.route('/open', methods=['POST'])
def open_file():
    """Open a file with the system default application."""
    data = request.json
    try:
        target_path = get_safe_path(data.get('path', ''))
        if not target_path.exists():
            return jsonify({"error": "File not found"}), 404
        subprocess.run(['open', str(target_path)])
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@files_bp.route('/create', methods=['POST'])
def create_project_folder():
    """Create a new project folder with standard sub-structure."""
    init_db_structure()
    data = request.json
    client_name = data.get('clientName')
    status_req = data.get('status', 'Prospect')
    if not client_name:
        return jsonify({"error": "Client name required"}), 400

    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        target_folder = STATUS_FOLDER_MAP.get(str(status_req).strip(), "Prospect")
        project_path = DESKTOP_PATH / target_folder / safe_name

        if project_path.exists():
            return jsonify({"error": "Project folder already exists"}), 409

        # Standard folder structure
        admin_root = project_path / "0- Admin"
        os.makedirs(admin_root / "0. Offre")
        os.makedirs(admin_root / "1. Contrat")
        os.makedirs(admin_root / "2. Factures")
        os.makedirs(project_path / "1. Charte graphique")
        os.makedirs(project_path / "2. Logo")
        site_root = project_path / "3. Site internet"
        os.makedirs(site_root / "1. Textes")
        os.makedirs(site_root / "2. Visuels")
        os.makedirs(site_root / "3. Commentaires")

        # Hidden admin metadata folder
        if not (project_path / ".99_Admin").exists():
            os.makedirs(project_path / ".99_Admin")

        return jsonify({
            "success": True,
            "path": str(project_path),
            "message": f"Dossier '{safe_name}' créé dans {target_folder}."
        })
    except Exception as e:
        return error_response(e)


@files_bp.route('/move', methods=['POST'])
def move_file():
    """Move a file to a client's project folder."""
    data = request.json
    try:
        source_path = DESKTOP_PATH / data.get('source')
        if not source_path.exists():
            return jsonify({"error": "Source not found"}), 404

        # Find client root
        client_root = None
        for status in ["Prospect", "Actif", "Archivé", "Pro bono", "Perso"]:
            p = DESKTOP_PATH / status / data.get('client')
            if p.exists():
                client_root = p
                break

        if not client_root:
            client_root = DESKTOP_PATH / "Prospect" / data.get('client')
            os.makedirs(client_root)

        target_dir = client_root / data.get('folder', '')
        if not target_dir.exists():
            os.makedirs(target_dir, exist_ok=True)

        target_path = target_dir / data.get('newName')
        if target_path.exists():
            base, ext = os.path.splitext(target_path.name)
            target_path = target_dir / f"{base}_{int(time.time())}{ext}"

        shutil.move(str(source_path), str(target_path))
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@files_bp.route('/rename', methods=['POST'])
def rename_file():
    """Rename a file or folder."""
    data = request.json
    old_path_rel = data.get('oldPath')
    new_name = data.get('newName')

    if not old_path_rel or not new_name:
        return jsonify({"error": "Missing parameters"}), 400
    try:
        old_path = get_safe_path(old_path_rel)
        if not old_path.exists():
            return jsonify({"error": "File not found"}), 404
        new_path = old_path.parent / new_name
        os.rename(str(old_path), str(new_path))
        return jsonify({"success": True, "newPath": str(new_path.relative_to(DESKTOP_PATH))})
    except Exception as e:
        return error_response(e)


@files_bp.route('/delete_item', methods=['POST'])
def delete_item():
    """Delete a file or folder."""
    data = request.json
    path_rel = data.get('path')

    if not path_rel:
        return jsonify({"error": "Path required"}), 400
    try:
        target_path = get_safe_path(path_rel)
        if not target_path.exists():
            return jsonify({"error": "Not found"}), 404

        if target_path.is_dir():
            shutil.rmtree(str(target_path))
        else:
            target_path.unlink()
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@files_bp.route('/move_item', methods=['POST'])
def move_item():
    """Move a file or folder to another location."""
    data = request.json
    source_rel = data.get('source')
    dest_rel = data.get('destination')

    if not source_rel or not dest_rel:
        return jsonify({"error": "Source and destination required"}), 400
    try:
        source_path = get_safe_path(source_rel)
        dest_path = get_safe_path(dest_rel) / source_path.name

        if not source_path.exists():
            return jsonify({"error": "Source not found"}), 404
        if not dest_path.parent.exists():
            os.makedirs(dest_path.parent, exist_ok=True)

        shutil.move(str(source_path), str(dest_path))
        return jsonify({"success": True, "newPath": str(dest_path.relative_to(DESKTOP_PATH))})
    except Exception as e:
        return error_response(e)
