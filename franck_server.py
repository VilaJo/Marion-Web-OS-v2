import os
import shutil
import json
import re
import time
import urllib.parse
import requests
import secrets
from datetime import datetime, timedelta
from typing import Optional
from flask import Flask, request, jsonify, Response, send_from_directory, redirect, session
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageOps, ImageDraw
import io
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate

# Security / Encryption
from crypto_utils import (
    generate_salt, hash_password, verify_password,
    encrypt_to_file, decrypt_from_file,
    encrypt_sensitive_fields, decrypt_sensitive_fields,
    migrate_json_to_encrypted
)

# Optional: dateutil for better date parsing
try:
    from dateutil import parser as date_parser
except ImportError:
    date_parser = None

try:
    import segno
except ImportError:
    segno = None

load_dotenv('.env.local')

app = Flask(__name__, static_folder='.dist')
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.secret_key = os.urandom(24)  # For session management

# CORS restrictif - uniquement localhost
CORS(app, 
     origins=["http://127.0.0.1:5003", "http://localhost:5003"],
     supports_credentials=True)

# --- Authentication Configuration ---
AUTH_FILE = None  # Set after DESKTOP_PATH is defined
active_sessions = {}  # {token: {"expiry": timestamp, "password": str}}
SESSION_DURATION = 8 * 60 * 60  # 8 heures
MAX_LOGIN_ATTEMPTS = 10
login_attempts = {}  # {ip: {"count": int, "reset_time": timestamp}}
current_password = None  # Mot de passe en memoire pour le chiffrement 

API_KEY = os.getenv("GEMINI_API_KEY")

# --- Google OAuth Config ---
# Les credentials sont lus depuis le fichier .env ou les variables d'environnement
from dotenv import load_dotenv
load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = "http://127.0.0.1:5003/api/oauth/google/callback"
GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar"

# Store tokens in memory (in production, use secure storage)
oauth_tokens = {}
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO_OWNER = "VilaJo"
GITHUB_REPO_NAME = "Marion-Web-OS-v2"

client = None

# --- Token Refresh Helper ---
def refresh_google_token(email: str) -> bool:
    """Refresh Google OAuth token if expired. Returns True if successful."""
    global oauth_tokens
    
    if email not in oauth_tokens:
        return False
    
    tokens = oauth_tokens[email]
    refresh_token = tokens.get('refresh_token')
    
    if not refresh_token:
        return False
    
    try:
        response = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        
        if response.status_code == 200:
            new_tokens = response.json()
            oauth_tokens[email]['access_token'] = new_tokens['access_token']
            if 'refresh_token' in new_tokens:
                oauth_tokens[email]['refresh_token'] = new_tokens['refresh_token']
            oauth_tokens[email]['expires_in'] = new_tokens.get('expires_in')
            
            # Persist updated tokens (chiffre si auth configuree)
            save_oauth_tokens_encrypted()
            
            return True
    except Exception as e:
        print(f"Token refresh failed: {e}", file=sys.stderr)
    
    return False

def get_valid_google_token(email: str) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    if email not in oauth_tokens:
        return None
    
    tokens = oauth_tokens[email]
    access_token = tokens.get('access_token')
    
    # Try the current token first
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v1/tokeninfo",
            params={"access_token": access_token},
            timeout=5
        )
        if response.status_code == 200:
            return access_token
    except:
        pass
    
    # Token might be expired, try to refresh
    if refresh_google_token(email):
        return oauth_tokens[email].get('access_token')
    
    return None

# --- File System Config ---
USER_HOME = Path.home()
DESKTOP_PATH = USER_HOME / "Desktop" / "Marion Web OS Database"
AUTH_FILE = DESKTOP_PATH / ".marion_auth.json"
OAUTH_TOKENS_ENC = DESKTOP_PATH / ".oauth_tokens.enc"
OAUTH_TOKENS_JSON = DESKTOP_PATH / ".oauth_tokens.json"  # Legacy

def init_db_structure():
    if not DESKTOP_PATH.exists():
        try: os.makedirs(DESKTOP_PATH)
        except OSError: pass
    
    folders = [
        "Prospect", "Actif", "Archivé", "Pro bono", "Perso", 
        "Notes", "Dépenses", "00_INBOX"
    ]
    
    for folder in folders:
        path = DESKTOP_PATH / folder
        if not path.exists(): os.makedirs(path)

    archive_subs = [
        "0. Associations", "1. Corporate", "2. Avocats", 
        "3. Médical", "4. Immobilier", "5. Mariages", 
        "6. Autre", "Audits"
    ]
    for sub in archive_subs:
        path = DESKTOP_PATH / "Archivé" / sub
        if not path.exists(): os.makedirs(path)

init_db_structure()

# --- Authentication Middleware ---
@app.before_request
def require_auth():
    """Middleware d'authentification - verifie le token sur chaque requete"""
    global current_password
    
    # Endpoints publics (pas d'auth requise)
    public_paths = [
        '/api/auth/check',
        '/api/auth/setup', 
        '/api/auth/login',
        '/api/auth/reset',
        '/setup',  # Gemini API setup (onboarding)
        '/check-status',  # Check Gemini status
    ]
    
    # Prefixes publics (OAuth flow doit fonctionner sans auth Marion)
    public_prefixes = [
        '/api/oauth/',  # Google OAuth flow
    ]
    
    if any(request.path.startswith(p) for p in public_prefixes):
        return None
    
    # Static files et assets - toujours accessibles
    static_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.map')
    if request.path.endswith(static_extensions):
        return None
    
    if request.path.startswith('/.dist') or request.path.startswith('/assets'):
        return None
    
    # Verifier si c'est un endpoint public
    if any(request.path == p for p in public_paths):
        return None
    
    # La page d'accueil (index.html) et routes frontend
    if request.path == '/' or not request.path.startswith('/api/'):
        return None
    
    # Verifier si l'auth est configuree
    if not AUTH_FILE.exists():
        # Pas encore configure, autoriser l'acces
        return None
    
    # Verifier le token de session
    token = request.headers.get('X-Marion-Token')
    if not token:
        return jsonify({"error": "Non authentifie", "code": "NO_TOKEN"}), 401
    
    if token not in active_sessions:
        return jsonify({"error": "Session invalide", "code": "INVALID_TOKEN"}), 401
    
    session_data = active_sessions[token]
    if session_data["expiry"] < time.time():
        del active_sessions[token]
        return jsonify({"error": "Session expiree", "code": "EXPIRED"}), 401
    
    # Mettre a jour le mot de passe en memoire pour le chiffrement
    current_password = session_data.get("password")
    
    return None


def check_rate_limit(ip: str) -> bool:
    """Verifie le rate limiting pour les tentatives de login"""
    now = time.time()
    
    if ip in login_attempts:
        data = login_attempts[ip]
        if data["reset_time"] < now:
            # Reset apres 1 minute
            login_attempts[ip] = {"count": 0, "reset_time": now + 60}
            return True
        if data["count"] >= MAX_LOGIN_ATTEMPTS:
            return False
    else:
        login_attempts[ip] = {"count": 0, "reset_time": now + 60}
    
    return True


def increment_login_attempt(ip: str):
    """Incremente le compteur de tentatives"""
    if ip in login_attempts:
        login_attempts[ip]["count"] += 1


# --- Authentication Endpoints ---
@app.route('/api/auth/check')
def auth_check():
    """Verifie si l'authentification est configuree"""
    is_configured = AUTH_FILE.exists()
    
    # Verifier si une session est active
    token = request.headers.get('X-Marion-Token')
    is_authenticated = False
    
    if token and token in active_sessions:
        if active_sessions[token]["expiry"] > time.time():
            is_authenticated = True
    
    return jsonify({
        "configured": is_configured,
        "authenticated": is_authenticated
    })


@app.route('/api/auth/setup', methods=['POST'])
def auth_setup():
    """Configure le mot de passe initial"""
    global current_password
    
    # Verifier si deja configure
    if AUTH_FILE.exists():
        return jsonify({"error": "Deja configure"}), 400
    
    data = request.get_json()
    password = data.get('password', '')
    
    # Validation du mot de passe
    if len(password) < 6:
        return jsonify({"error": "Mot de passe trop court (min 6 caracteres)"}), 400
    
    # Generer salt et hasher le mot de passe
    salt = generate_salt()
    password_hash = hash_password(password, salt)
    
    # Sauvegarder
    auth_data = {
        "salt": base64.b64encode(salt).decode(),
        "password_hash": password_hash,
        "created_at": datetime.now().isoformat()
    }
    
    with open(AUTH_FILE, 'w') as f:
        json.dump(auth_data, f)
    
    # Creer une session
    token = secrets.token_urlsafe(32)
    active_sessions[token] = {
        "expiry": time.time() + SESSION_DURATION,
        "password": password
    }
    current_password = password
    
    # Migrer les donnees existantes vers le format chiffre
    migrate_existing_data(password)
    
    return jsonify({
        "success": True,
        "token": token,
        "message": "Mot de passe configure"
    })


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Connexion avec mot de passe"""
    global current_password
    
    # Rate limiting
    client_ip = request.remote_addr
    if not check_rate_limit(client_ip):
        return jsonify({"error": "Trop de tentatives. Reessayez dans 1 minute."}), 429
    
    # Verifier si configure
    if not AUTH_FILE.exists():
        return jsonify({"error": "Non configure", "code": "NOT_CONFIGURED"}), 400
    
    data = request.get_json()
    password = data.get('password', '')
    
    # Charger les donnees d'auth
    try:
        with open(AUTH_FILE, 'r') as f:
            auth_data = json.load(f)
    except Exception:
        return jsonify({"error": "Erreur de lecture"}), 500
    
    salt = base64.b64decode(auth_data["salt"])
    stored_hash = auth_data["password_hash"]
    
    # Verifier le mot de passe
    if not verify_password(password, salt, stored_hash):
        increment_login_attempt(client_ip)
        return jsonify({"error": "Mot de passe incorrect"}), 401
    
    # Creer une session
    token = secrets.token_urlsafe(32)
    active_sessions[token] = {
        "expiry": time.time() + SESSION_DURATION,
        "password": password
    }
    current_password = password
    
    # Charger les tokens OAuth chiffres
    load_oauth_tokens_encrypted(password)
    
    return jsonify({
        "success": True,
        "token": token
    })


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Deconnexion"""
    global current_password
    
    token = request.headers.get('X-Marion-Token')
    if token and token in active_sessions:
        del active_sessions[token]
    
    current_password = None
    
    return jsonify({"success": True})


@app.route('/api/auth/reset', methods=['POST'])
def auth_reset():
    """Reinitialise l'authentification - SUPPRIME les donnees chiffrees"""
    global current_password, oauth_tokens, active_sessions
    
    data = request.get_json()
    confirm = data.get('confirm', '')
    
    if confirm != 'RESET':
        return jsonify({"error": "Confirmation requise"}), 400
    
    try:
        # Supprimer le fichier d'auth
        if AUTH_FILE.exists():
            AUTH_FILE.unlink()
            print("Auth file deleted", file=sys.stderr)
        
        # Supprimer les tokens OAuth chiffres
        if OAUTH_TOKENS_ENC.exists():
            OAUTH_TOKENS_ENC.unlink()
            print("Encrypted OAuth tokens deleted", file=sys.stderr)
        
        # Supprimer les tokens OAuth non chiffres (legacy)
        if OAUTH_TOKENS_JSON.exists():
            OAUTH_TOKENS_JSON.unlink()
            print("Legacy OAuth tokens deleted", file=sys.stderr)
        
        # Vider les sessions et tokens en memoire
        active_sessions.clear()
        oauth_tokens.clear()
        current_password = None
        
        return jsonify({
            "success": True,
            "message": "Authentification reinitialisee. Vous pouvez configurer un nouveau mot de passe."
        })
        
    except Exception as e:
        print(f"Reset error: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500


def migrate_existing_data(password: str):
    """Migre les donnees existantes vers le format chiffre"""
    global oauth_tokens
    
    # Migrer les tokens OAuth
    if OAUTH_TOKENS_JSON.exists() and not OAUTH_TOKENS_ENC.exists():
        try:
            with open(OAUTH_TOKENS_JSON, 'r') as f:
                tokens_data = json.load(f)
            
            if encrypt_to_file(tokens_data, password, OAUTH_TOKENS_ENC):
                # Supprimer l'ancien fichier
                OAUTH_TOKENS_JSON.unlink()
                print("Tokens OAuth migres vers format chiffre", file=sys.stderr)
                oauth_tokens = tokens_data
        except Exception as e:
            print(f"Erreur migration tokens: {e}", file=sys.stderr)


def load_oauth_tokens_encrypted(password: str):
    """Charge les tokens OAuth depuis le fichier chiffre"""
    global oauth_tokens
    
    if OAUTH_TOKENS_ENC.exists():
        try:
            tokens_data = decrypt_from_file(OAUTH_TOKENS_ENC, password)
            if tokens_data:
                oauth_tokens = tokens_data
                print(f"Tokens OAuth charges (chiffres): {list(oauth_tokens.keys())}", file=sys.stderr)
        except ValueError as e:
            print(f"Erreur dechiffrement tokens: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Erreur chargement tokens: {e}", file=sys.stderr)


def save_oauth_tokens_encrypted():
    """Sauvegarde les tokens OAuth dans le fichier chiffre"""
    global oauth_tokens, current_password
    
    if current_password and oauth_tokens:
        try:
            encrypt_to_file(oauth_tokens, current_password, OAUTH_TOKENS_ENC)
        except Exception as e:
            print(f"Erreur sauvegarde tokens: {e}", file=sys.stderr)


# Load OAuth tokens from file on startup (legacy support)
def load_oauth_tokens():
    global oauth_tokens
    tokens_file = DESKTOP_PATH / ".oauth_tokens.json"
    if tokens_file.exists():
        try:
            with open(tokens_file, 'r') as f:
                oauth_tokens.update(json.load(f))
            print(f"Loaded OAuth tokens for: {list(oauth_tokens.keys())}", file=sys.stderr)
        except Exception as e:
            print(f"Failed to load OAuth tokens: {e}", file=sys.stderr)

load_oauth_tokens()

# --- UTILS ---
def get_safe_path(req_path):
    clean_req = req_path.lstrip('/') if req_path else ""
    full_path = (DESKTOP_PATH / clean_req).resolve()
    if not str(full_path).startswith(str(DESKTOP_PATH)):
        raise ValueError("Access denied")
    return full_path

def init_client():
    global client, API_KEY
    API_KEY = os.getenv("GEMINI_API_KEY")
    if not API_KEY and os.path.exists('.env.local'):
        try:
            with open('.env.local', 'r') as f:
                for line in f:
                    if line.startswith('GEMINI_API_KEY='):
                        API_KEY = line.strip().split('=', 1)[1]
                        break
        except: pass

    if API_KEY:
        try:
            clean_key = API_KEY.strip().replace('"', '').replace("'", "")
            client = genai.Client(api_key=clean_key)
            print(f"Gemini Client Initialized")
        except Exception as e: 
            print(f"Client Init Failed: {e}")
            client = None
    else:
        print("No API Key found")

def get_project_progress(project_path, tasks=None):
    folder_progress = 10
    try:
        if (project_path / "01_Brief").exists() and any(f.is_file() for f in (project_path / "01_Brief").iterdir() if not f.name.startswith('.')): folder_progress += 20
        if (project_path / "03_Design").exists() and any(f.is_file() for f in (project_path / "03_Design").iterdir() if not f.name.startswith('.')): folder_progress += 30
        if (project_path / "04_Livraison").exists() and any(f.is_file() for f in (project_path / "04_Livraison").iterdir() if not f.name.startswith('.')): folder_progress += 40
    except: pass
    
    task_progress = 0
    if tasks and len(tasks) > 0:
        completed = sum(1 for t in tasks if t.get('completed'))
        task_progress = int((completed / len(tasks)) * 100)
        final_progress = int((folder_progress + task_progress) / 2)
    else:
        final_progress = folder_progress
    return min(final_progress, 100)

# Sensitive fields to encrypt in project data
SENSITIVE_PROJECT_FIELDS = ['credentials', 'privateNotes']

def load_project_data(project_path):
    """Load project data and decrypt sensitive fields if auth is configured"""
    global current_password
    json_path = project_path / ".99_Admin" / "project.json"
    if json_path.exists():
        try:
            with open(json_path, 'r') as f: 
                data = json.load(f)
            
            # Decrypt sensitive fields if auth is configured and password available
            if current_password and AUTH_FILE.exists():
                try:
                    # Load salt from auth file
                    with open(AUTH_FILE, 'r') as f:
                        auth_data = json.load(f)
                    salt = base64.b64decode(auth_data["salt"])
                    
                    data = decrypt_sensitive_fields(data, current_password, salt, SENSITIVE_PROJECT_FIELDS)
                except Exception as e:
                    print(f"Warning: Could not decrypt sensitive fields: {e}", file=sys.stderr)
            
            return data
        except Exception as e:
            print(f"Error loading project data: {e}", file=sys.stderr)
    return {}

def save_project_data_file(project_path, data):
    """Save project data and encrypt sensitive fields if auth is configured"""
    global current_password
    admin_path = project_path / ".99_Admin"
    if not admin_path.exists(): os.makedirs(admin_path)
    json_path = admin_path / "project.json"
    
    data_to_save = data.copy()
    
    # Encrypt sensitive fields if auth is configured and password available
    if current_password and AUTH_FILE.exists():
        try:
            # Load salt from auth file
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)
            salt = base64.b64decode(auth_data["salt"])
            
            data_to_save = encrypt_sensitive_fields(data_to_save, current_password, salt, SENSITIVE_PROJECT_FIELDS)
        except Exception as e:
            print(f"Warning: Could not encrypt sensitive fields: {e}", file=sys.stderr)
    
    with open(json_path, 'w') as f: json.dump(data_to_save, f, indent=2)

def save_avatar_file(project_path, data_url):
    try:
        if not data_url or not data_url.startswith('data:'): return False
        header, encoded = data_url.split(",", 1)
        ext = "png"
        if "svg" in header: ext = "svg"
        elif "jpeg" in header or "jpg" in header: ext = "jpg"
        file_path = project_path / ".99_Admin" / f"avatar.{ext}"
        with open(file_path, "wb") as f: f.write(base64.b64decode(encoded))
        return True
    except Exception: return False

def load_avatar_file(project_path):
    try:
        admin_path = project_path / ".99_Admin"
        for ext in ["svg", "png", "jpg"]:
            file_path = admin_path / f"avatar.{ext}"
            if file_path.exists():
                with open(file_path, "rb") as f:
                    content = f.read()
                    mime = f"image/svg+xml" if ext == "svg" else f"image/{ext}"
                    b64 = base64.b64encode(content).decode('utf-8')
                    return f"data:{mime};base64,{b64}"
    except: pass
    return None

# --- API ROUTES ---

@app.route('/check-status', methods=['GET'])
def check_status():
    if not client: init_client()
    return jsonify({"configured": bool(client)})

@app.route('/setup', methods=['POST'])
def setup():
    data = request.json
    api_key = data.get('api_key')
    if not api_key: return jsonify({"error": "API Key required"}), 400
    try:
        # Test the API key with a simple request
        test_client = genai.Client(api_key=api_key)
        # Try multiple model names for compatibility
        test_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]
        test_success = False
        for model_name in test_models:
            try:
                test_client.models.generate_content(model=model_name, contents="Hello")
                test_success = True
                break
            except Exception:
                continue
        
        if not test_success:
            # If all models fail, just verify the key format and save it
            if not api_key.startswith("AIza"):
                return jsonify({"error": "Invalid API key format"}), 400
        
        with open('.env.local', 'w') as f: f.write(f"GEMINI_API_KEY={api_key}\n")
        global API_KEY
        API_KEY = api_key
        init_client()
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 400

@app.route('/api/generate-qr', methods=['POST'])
def generate_qr():
    if not segno: return jsonify({"error": "Segno manquant"}), 500
    data = request.json
    try:
        raw_iban = str(data.get('iban', '')).replace(" ", "")
        
        debtor = data.get('debtor', {})
        d_name = debtor.get('name') or 'Client'
        d_addr = debtor.get('address') or ''
        d_zip = debtor.get('zip') or '1000'
        d_city = debtor.get('city') or 'Lausanne'
        
        amount = f"{float(data.get('amount', 0.0)):.2f}"
        ref_msg = data.get('message', '')

        lines = [
            "SPC",              # 01. Header
            "0200",             # 02. Version
            "1",                # 03. Coding
            raw_iban,           # 04. IBAN
            "K",                # 05. Creditor Type
            "Marion Web",       # 06. Name
            "4A chemin du Port",# 07. Address 1
            "1246 Corsier",     # 08. Address 2
            "", "",             # 09-10. Empty
            "CH",               # 11. Country
            "", "", "", "", "", "", "", # 12-18. Ult Cdt (7 lines empty)
            amount,             # 19. Amount
            "CHF",              # 20. Currency
            "K",                # 21. Debtor Type
            d_name,             # 22. Name
            d_addr,             # 23. Address 1
            f"{d_zip} {d_city}",# 24. Address 2
            "", "",             # 25-26. Empty
            "CH",               # 27. Country
            "NON",              # 28. Ref Type
            "",                 # 29. Ref
            ref_msg,            # 30. Message
            "EPD"               # 31. Trailer
        ]
        
        payload = "\r\n".join(lines)
        payload_bytes = payload.encode('iso-8859-1', errors='replace')
        
        qr = segno.make(payload_bytes, error='M', micro=False) # micro=False for Swiss QR
        
        buff = io.BytesIO()
        qr.save(buff, kind='png', scale=10, border=4) 
        buff.seek(0)
        
        qr_img = Image.open(buff).convert("RGBA")
        width, height = qr_img.size
        cross_size = int(width * 0.14)
        
        logo = Image.new("RGBA", (cross_size, cross_size), (0,0,0,0))
        draw = ImageDraw.Draw(logo)
        draw.rectangle([(0,0), (cross_size-1, cross_size-1)], fill="black")
        gap = int(cross_size * 0.08)
        draw.rectangle([(gap, gap), (cross_size-gap-1, cross_size-gap-1)], fill="white")
        red_inset = int(cross_size * 0.16)
        draw.rectangle([(red_inset, red_inset), (cross_size-red_inset-1, cross_size-red_inset-1)], fill="#FF0000")
        red_inner = cross_size - (2 * red_inset)
        c = cross_size // 2
        thick = int(red_inner * 0.33); length = int(red_inner * 0.85) // 2
        draw.rectangle([(c-thick//2, c-length), (c+thick//2, c+length)], fill="white")
        draw.rectangle([(c-length, c-thick//2), (c+length, c+thick//2)], fill="white")
        
        pos = ((width - cross_size) // 2, (height - cross_size) // 2)
        qr_img.paste(logo, pos, logo)
        
        final_buff = io.BytesIO()
        qr_img.save(final_buff, format="PNG")
        final_buff.seek(0)
        img_str = base64.b64encode(final_buff.getvalue()).decode('utf-8')
        
        return jsonify({"success": True, "image": f"data:image/png;base64,{img_str}"})
    except Exception as e: 
        print(f"QR Gen Error: {e}") # Log the full error
        return jsonify({"error": str(e)}), 400

@app.route('/api/projects/scan', methods=['GET'])
def scan_projects():
    projects = []
    folder_map = {
        "Prospect": "Prospect", "Actif": "Active", "Archivé": "Archived", "Pro bono": "Pro Bono", "Perso": "Perso"
    }
    archive_categories = [
        "0. Associations", "1. Corporate", "2. Avocats", "3. Médical", "4. Immobilier", "5. Mariages", "6. Autre", "Audits"
    ]

    try:
        for folder_name, status in folder_map.items():
            status_path = DESKTOP_PATH / folder_name
            if status_path.exists():
                
                def process_entry(entry):
                    data = load_project_data(entry)
                    avatar_img = load_avatar_file(entry) or data.get('avatarImage')
                    progress = get_project_progress(entry, data.get('tasks', []))
                    return {
                        "id": str(entry.relative_to(DESKTOP_PATH)), "name": entry.name, "clientName": entry.name, "status": status,
                        "path": str(entry.relative_to(DESKTOP_PATH)), "progress": progress,
                        "tasks": data.get('tasks', []), "invoices": data.get('invoices', []),
                        "profile": data.get('profile', {}), "brandKit": data.get('brandKit', {}),
                        "credentials": data.get('credentials', []), "moodboard": data.get('moodboard', []),
                        "avatarImage": avatar_img, "avatarColor": data.get('avatarColor'),
                        "avatarInitials": data.get('avatarInitials', entry.name[:2].upper()),
                        "logoLabData": data.get('logoLabData'), "archiveCategory": None
                    }

                for entry in status_path.iterdir():
                    if entry.is_dir() and not entry.name.startswith('.'):
                        if folder_name == "Archivé" and entry.name in archive_categories:
                            for sub in entry.iterdir():
                                if sub.is_dir() and not sub.name.startswith('.'):
                                    p = process_entry(sub)
                                    p['archiveCategory'] = entry.name
                                    projects.append(p)
                        else:
                            projects.append(process_entry(entry))
                            
        return jsonify({"projects": projects})
    except Exception as e: 
        print(f"Scan projects error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/save', methods=['POST'])
def save_project():
    data = request.json
    project_id = data.get('id')
    if not project_id: return jsonify({"error": "Project ID required"}), 400
    try:
        project_path = get_safe_path(project_id)
        if not project_path.exists(): return jsonify({"error": "Project not found"}), 404
        
        avatar_data = data.get('avatarImage')
        if avatar_data and str(avatar_data).startswith('data:'):
            save_avatar_file(project_path, avatar_data)
            # Remove huge base64 string from JSON metadata to keep it clean
            # The frontend will reload it via load_avatar_file (scanning disk)
            if 'avatarImage' in data:
                del data['avatarImage']
        
        save_project_data_file(project_path, data)
        progress = get_project_progress(project_path, data.get('tasks', []))
        return jsonify({"success": True, "progress": progress})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/list', methods=['POST'])
def list_files():
    data = request.json
    path_str = data.get('path', '') 
    try:
        target_path = get_safe_path(path_str)
        if not target_path.exists(): return jsonify({"items": []})
        items = []
        for entry in target_path.iterdir():
            if entry.name.startswith('.') or entry.name == 'Icon\r': continue
            items.append({"name": entry.name, "type": "folder" if entry.is_dir() else "file", "path": str(entry.relative_to(target_path))})
        items.sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
        return jsonify({"items": items})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/open', methods=['POST'])
def open_file():
    data = request.json
    try:
        target_path = get_safe_path(data.get('path', ''))
        if not target_path.exists(): return jsonify({"error": "File not found"}), 404
        subprocess.run(['open', str(target_path)])
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/create', methods=['POST'])
def create_project_folder():
    init_db_structure()
    data = request.json
    client_name = data.get('clientName')
    status_req = data.get('status', 'Prospect')
    if not client_name: return jsonify({"error": "Client name required"}), 400
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        folder_map = {
            "Active": "Actif", "Actif": "Actif",
            "Prospect": "Prospect",
            "Archived": "Archivé", "Archivé": "Archivé",
            "Pro Bono": "Pro bono", "Pro bono": "Pro bono",
            "Perso": "Perso"
        }
        target_folder = folder_map.get(str(status_req).strip(), "Prospect")
        project_path = DESKTOP_PATH / target_folder / safe_name
        if project_path.exists():
            return jsonify({"error": "Project folder already exists"}), 409

        # 0- Admin with Offre / Contrat / Factures
        admin_root = project_path / "0- Admin"
        os.makedirs(admin_root / "0. Offre")
        os.makedirs(admin_root / "1. Contrat")
        os.makedirs(admin_root / "2. Factures")

        # Design / branding structure
        os.makedirs(project_path / "1. Charte graphique")
        os.makedirs(project_path / "2. Logo")

        # Site internet with Textes / Visuels / Commentaires
        site_root = project_path / "3. Site internet"
        os.makedirs(site_root / "1. Textes")
        os.makedirs(site_root / "2. Visuels")
        os.makedirs(site_root / "3. Commentaires")

        # Hidden admin metadata folder
        if not (project_path / ".99_Admin").exists():
            os.makedirs(project_path / ".99_Admin")
        
        return jsonify({"success": True, "path": str(project_path), "message": f"Dossier '{safe_name}' créé dans {target_folder}."})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/dispatch', methods=['POST'])
def dispatch_file():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    try:
        temp_dir = DESKTOP_PATH / ".99_Admin" / "temp_dispatch"
        if not temp_dir.exists(): os.makedirs(temp_dir)
        temp_path = temp_dir / f"dispatch_{int(time.time())}{Path(file.filename).suffix}"
        file_content = file.read()
        with open(temp_path, "wb") as f: f.write(file_content)
        
        clients = []
        for status in ["Prospect", "Actif", "Archivé", "Pro bono", "Perso"]:
            p = DESKTOP_PATH / status
            if p.exists():
                clients.extend([d.name for d in p.iterdir() if d.is_dir() and not d.name.startswith('.')])
        
        suggestion = {"client": "Unknown", "folder": "0- Admin/2. Factures", "newName": file.filename, "reason": "AI not available"}
        if client:
            try:
                mime_type = "application/pdf" if temp_path.suffix.lower() == '.pdf' else "image/jpeg"
                prompt = f"""
                You are Franck.
                KNOWN CLIENTS: {json.dumps(clients)}.
                KNOWN FOLDERS inside each client:
                  - "0- Admin/0. Offre"
                  - "0- Admin/1. Contrat"
                  - "0- Admin/2. Factures"
                  - "1. Charte graphique"
                  - "2. Logo"
                  - "3. Site internet/1. Textes"
                  - "3. Site internet/2. Visuels"
                  - "3. Site internet/3. Commentaires"
                
                Task: Identify the most appropriate client and folder for this file, and suggest a clean professional filename.
                Return JSON ONLY: {{ "client": "...", "folder": "...", "newName": "...", "reason": "..." }}
                """
                response = client.models.generate_content(model="gemini-2.5-pro", contents=[types.Content(role="user", parts=[types.Part.from_bytes(data=file_content, mime_type=mime_type), types.Part.from_text(text=prompt)])], config=types.GenerateContentConfig(response_mime_type="application/json"))
                ai_result = json.loads(response.text.replace("```json", "").replace("```", "").strip())
                suggestion.update({k: v for k, v in ai_result.items() if k in suggestion})
            except Exception: pass
            
        return jsonify({"success": True, "tempPath": str(temp_path.relative_to(DESKTOP_PATH)), "suggestion": suggestion})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/move', methods=['POST'])
def move_file():
    data = request.json
    try:
        source_path = DESKTOP_PATH / data.get('source')
        if not source_path.exists(): return jsonify({"error": "Source not found"}), 404
        
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
        if not target_dir.exists(): os.makedirs(target_dir, exist_ok=True)
        
        target_path = target_dir / data.get('newName')
        if target_path.exists():
            base, ext = os.path.splitext(target_path.name)
            target_path = target_dir / f"{base}_{int(time.time())}{ext}"
            
        shutil.move(str(source_path), str(target_path))
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/projects/move', methods=['POST'])
def move_project_status():
    data = request.json
    client_name = data.get('clientName')
    new_status = data.get('newStatus')
    archive_category = data.get('archiveCategory')
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        source_path = None
        for folder in ["Prospect", "Actif", "Pro bono", "Perso", "Archivé"]:
            p = DESKTOP_PATH / folder / safe_name
            if p.exists(): source_path = p; break
            if folder == "Archivé":
                for sub in [d for d in p.iterdir() if d.is_dir()]:
                    if (sub / safe_name).exists(): source_path = sub / safe_name; break
        if not source_path: return jsonify({"error": "Project not found"}), 404

        status_map = {"Active": "Actif", "Actif": "Actif", "Prospect": "Prospect", "Archived": "Archivé", "Archivé": "Archivé", "Pro Bono": "Pro bono", "Pro bono": "Pro bono", "Perso": "Perso"}
        dest_base = DESKTOP_PATH / status_map.get(new_status, "Prospect")
        dest_path = dest_base / archive_category / safe_name if (new_status == "Archived" and archive_category) else dest_base / safe_name
        
        if not dest_path.parent.exists(): os.makedirs(dest_path.parent)
        if str(source_path) != str(dest_path): shutil.move(str(source_path), str(dest_path))
        
        try:
            json_path = dest_path / ".99_Admin" / "project.json"
            if json_path.exists():
                with open(json_path, 'r') as f: p_data = json.load(f)
                p_data['status'] = new_status
                if new_status == "Archived": p_data['archiveCategory'] = archive_category
                with open(json_path, 'w') as f: json.dump(p_data, f, indent=2)
        except: pass
        
        return jsonify({"success": True, "path": str(dest_path.relative_to(DESKTOP_PATH))})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/projects/archive', methods=['POST'])
def archive_project():
    return move_project_status()

@app.route('/api/projects/delete', methods=['DELETE'])
def delete_project():
    client_name = request.args.get('clientName')
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        target_path = None
        for folder in ["Prospect", "Actif", "Archivé", "Pro bono", "Perso"]:
            p = DESKTOP_PATH / folder / safe_name
            if p.exists(): target_path = p; break
        
        if target_path and str(target_path).startswith(str(DESKTOP_PATH)):
            shutil.rmtree(target_path)
            return jsonify({"success": True})
        return jsonify({"error": "Project not found"}), 404
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/rename', methods=['POST'])
def rename_file():
    data = request.json
    old_path_rel = data.get('oldPath')
    new_name = data.get('newName')
    
    if not old_path_rel or not new_name: return jsonify({"error": "Missing parameters"}), 400
    try:
        old_path = get_safe_path(old_path_rel)
        if not old_path.exists(): return jsonify({"error": "File not found"}), 404
        new_path = old_path.parent / new_name
        if new_path.exists(): return jsonify({"error": "A file with this name already exists"}), 409
        os.rename(old_path, new_path)
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/delete_item', methods=['POST'])
def delete_file_item():
    data = request.json
    path_rel = data.get('path')
    if not path_rel: return jsonify({"error": "Missing path"}), 400
    try:
        target_path = get_safe_path(path_rel)
        if not target_path.exists(): return jsonify({"error": "Item not found"}), 404
        if target_path.is_dir(): shutil.rmtree(target_path)
        else: os.remove(target_path)
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/files/move_item', methods=['POST'])
def move_file_item():
    data = request.json
    source_rel = data.get('source')
    dest_rel = data.get('destination')
    if not source_rel or not dest_rel: return jsonify({"error": "Missing parameters"}), 400
    try:
        source_path = get_safe_path(source_rel)
        dest_path = get_safe_path(dest_rel)
        if not source_path.exists(): return jsonify({"error": "Source not found"}), 404
        shutil.move(str(source_path), str(dest_path))
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- Time Tracker API ---
@app.route('/api/time/log', methods=['POST'])
def log_time():
    data = request.json
    client_id = data.get('clientId')
    entry = data.get('entry')
    if not client_id or not entry: return jsonify({"error": "Missing data"}), 400
    try:
        safe_path = get_safe_path(client_id)
        admin_path = safe_path / ".99_Admin"
        if not admin_path.exists(): os.makedirs(admin_path)
        sheet_path = admin_path / "timesheet.json"
        logs = []
        if sheet_path.exists():
            try:
                with open(sheet_path, 'r') as f: logs = json.load(f)
            except: pass
        entry['id'] = f"log-{int(time.time())}-{len(logs)}"
        entry['status'] = 'pending'
        logs.append(entry)
        with open(sheet_path, 'w') as f: json.dump(logs, f, indent=2)
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/time/mark_billed', methods=['POST'])
def mark_time_billed():
    data = request.json
    client_id = data.get('clientId')
    log_ids = data.get('logIds', [])
    try:
        safe_path = get_safe_path(client_id)
        sheet_path = safe_path / ".99_Admin" / "timesheet.json"
        if not sheet_path.exists(): return jsonify({"error": "No timesheet found"}), 404
        with open(sheet_path, 'r') as f: logs = json.load(f)
        updated_count = 0
        for log in logs:
            if log.get('id') in log_ids:
                log['status'] = 'billed'
                updated_count += 1
        with open(sheet_path, 'w') as f: json.dump(logs, f, indent=2)
        return jsonify({"success": True, "updated": updated_count})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/time/get', methods=['POST'])
def get_time_logs():
    data = request.json
    client_id = data.get('clientId')
    try:
        safe_path = get_safe_path(client_id)
        sheet_path = safe_path / "99_Admin" / "timesheet.json"
        if sheet_path.exists():
            with open(sheet_path, 'r') as f: logs = json.load(f)
            return jsonify({"logs": logs})
        else: return jsonify({"logs": []})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- Expenses API ---
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    expenses_path = DESKTOP_PATH / "Dépenses"
    if not expenses_path.exists(): os.makedirs(expenses_path)
    expenses = []
    try:
        for entry in expenses_path.glob("*.json"):
            try:
                with open(entry, 'r') as f:
                    data = json.load(f)
                    expenses.append(data)
            except: pass
        expenses.sort(key=lambda x: x.get('date', ''), reverse=True)
        return jsonify({"expenses": expenses})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/expenses/scan', methods=['POST'])
def scan_expense():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    try:
        expenses_path = DESKTOP_PATH / "Dépenses"
        if not expenses_path.exists(): os.makedirs(expenses_path)
        file_ext = Path(file.filename).suffix
        expense_id = f"exp-{int(time.time())}"
        file_name = f"{expense_id}{file_ext}"
        file_path = expenses_path / file_name
        file.save(file_path)
        expense_data = {"id": expense_id, "date": os.popen('date +%F').read().strip(), "supplier": "Inconnu", "amount": 0, "category": "Other", "description": "Scan échoué", "fileUrl": str(file_path)}
        if client:
            try:
                mime_type = "application/pdf" if file_ext.lower() == '.pdf' else "image/jpeg"
                if file_ext.lower() in ['.png', '.webp']: mime_type = f"image/{file_ext[1:]}"
                with open(file_path, "rb") as f: file_content = f.read()
                prompt = """Analyze this receipt/invoice. Extract: - Supplier Name (merchant) - Total Amount (Grand Total) - Date (YYYY-MM-DD) - Category (Choose one: Software, Hardware, Office, Travel, Services, Tax, Other) - Description (Short summary). Return ONLY JSON: { \"supplier\": \"\", \"amount\": 0.0, \"date\": \"\", \"category\": \"\", \"description\": \"\" }"""
                response = client.models.generate_content(model="gemini-2.5-pro", contents=[types.Part.from_bytes(data=file_content, mime_type=mime_type), types.Part.from_text(text=prompt)], config=types.GenerateContentConfig(response_mime_type="application/json"))
                extracted = json.loads(response.text)
                expense_data.update(extracted)
            except Exception as ai_e: print(f"AI Expense Scan Error: {ai_e}")
        json_path = expenses_path / f"{expense_id}.json"
        with open(json_path, 'w') as f: json.dump(expense_data, f, indent=2)
        return jsonify({"success": True, "expense": expense_data})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        expenses_path = DESKTOP_PATH / "Dépenses"
        json_path = expenses_path / f"{expense_id}.json"
        if json_path.exists(): os.remove(json_path)
        for f in expenses_path.glob(f"{expense_id}.*"): os.remove(f)
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- Notes API ---
@app.route('/api/notes', methods=['GET'])
def get_notes():
    notes_path = DESKTOP_PATH / "Notes"
    if not notes_path.exists(): os.makedirs(notes_path)
    notes = []
    try:
        for entry in notes_path.glob("*.json"):
            try: notes.append(json.load(open(entry, 'r')));
            except: pass
        notes.sort(key=lambda x: x.get('date', ''), reverse=True)
        return jsonify({"notes": notes})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/notes', methods=['POST'])
def save_note():
    data = request.json
    note_id = data.get('id')
    if not note_id: return jsonify({"error": "Note ID required"}), 400
    try:
        notes_path = DESKTOP_PATH / "Notes"
        if not notes_path.exists(): os.makedirs(notes_path)
        file_path = notes_path / f"{note_id}.json"
        with open(file_path, 'w') as f: json.dump(data, f, indent=2)
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/notes', methods=['DELETE'])
def delete_note():
    note_id = request.args.get('id')
    if not note_id: return jsonify({"error": "Note ID required"}), 400
    try:
        file_path = DESKTOP_PATH / "Notes" / f"{note_id}.json"
        if file_path.exists(): os.remove(file_path)
        else: return jsonify({"error": "Note not found"}), 404
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/notes/ai', methods=['POST'])
def ai_note_action():
    global client, API_KEY
    
    # 1. Force Init if missing
    if not client:
        print("⚠️ Client was None, attempting re-init...")
        init_client()
        
    if not client:
        print("❌ Client Init Failed even after retry.")
        return jsonify({"error": "Server configuration error: Gemini Client is None"}), 503

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
            
        action = data.get('action')
        text = data.get('text', '')
        
        print(f"🤖 AI Request: {action} (len: {len(text)})")
        
        if not text:
            return jsonify({"error": "Texte vide"}), 400
        
        # 2. Construct Prompt
        prompt = ""
        if action == 'improve':
            prompt = f"Reformule ce texte de manière plus professionnelle et claire :\n\n{text}"
        elif action == 'summarize':
            prompt = f"Résumé concis :\n\n{text}"
        elif action == 'tasks':
            prompt = f"Checklist des tâches :\n\n{text}"
        elif action == 'continue':
            prompt = f"Suite logique :\n\n{text}"
        else:
            prompt = f"Améliore ce texte :\n\n{text}"

        # 3. Call API with extreme simplicity
        print(f"📤 Sending to Gemini (Model: gemini-2.5-pro)...")
        try:
            # Direct call, no complex config objects for now to isolate issue
            response = client.models.generate_content(
                model="gemini-2.5-pro", 
                contents=prompt
            )
            print("✅ Response received")
            return jsonify({"success": True, "result": response.text})
            
        except Exception as e1:
            print(f"⚠️ Primary Model Failed: {e1}")
            try:
                print("🔄 Retrying with gemini-2.5-flash...")
                response = client.models.generate_content(
                    model="gemini-2.5-flash", 
                    contents=prompt
                )
                return jsonify({"success": True, "result": response.text})
            except Exception as e2:
                print(f"❌ All Models Failed: {e2}")
                return jsonify({"error": f"AI Error: {str(e2)}"}), 500

    except Exception as e: 
        print(f"❌ Server Crash in ai_note_action: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/briefing', methods=['POST'])
def briefing():
    if not client: return jsonify({"error": "Server not configured"}), 503
    data = request.json
    try:
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"""
            Tu es le Rédacteur en Chef de "Marion Web OS News", l'assistant personnel de Marion.
            Ton objectif : Rédiger un briefing hebdomadaire structuré, élégant et ultra-motivant.

            CONTEXTE ACTUEL :
            {data.get('context','')}

            CONSIGNES DE RÉDACTION :
            - Format : HTML brut (compatible Tailwind : utilise des classes comme text-xl, font-bold, text-brand-orange, bg-orange-50, p-4, rounded-xl).
            - Ton : Chaleureux, professionnel, un peu "coach de vie" mais très concret.
            - Pas de markdown (```html), juste le code HTML pur.

            STRUCTURE DU BRIEFING :

            contents=f'''
            Tu es le Rédacteur en Chef de "Marion Web OS News", l'assistant personnel de Marion.
            Ton objectif : Rédiger un briefing hebdomadaire structuré, élégant et ultra-motivant.

            CONTEXTE ACTUEL :
            {data.get('context','')}

            CONSIGNES DE RÉDACTION :
            - Format : HTML brut (compatible Tailwind : utilise des classes comme text-xl, font-bold, text-brand-orange, bg-orange-50, p-4, rounded-xl).
            - Ton : Chaleureux, professionnel, un peu "coach de vie" mais très concret.
            - Pas de markdown (```html), juste le code HTML pur.

            STRUCTURE DU BRIEFING :

            <div class="space-y-6 font-sans text-slate-700 dark:text-slate-300">
                
                <!-- 1. L'Édito -->
                <div class="bg-[#FDFCF8] dark:bg-slate-800 p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#F5EFE6] dark:border-slate-700">
                    <h3 class="text-3xl font-serif font-bold text-slate-800 dark:text-white mb-4">🦁&nbsp;L'Édito de la Semaine</h3>
                    <p class="leading-relaxed text-lg text-slate-600 dark:text-slate-300 font-light">
                        [Écris ici un paragraphe d'introduction motivant basé sur la charge de travail et l'humeur du moment. Encourage Marion.]
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- 2. Cap sur le Yacht -->
                    <div class="bg-gradient-to-br from-[#F0F9FF] to-[#E6F4FE] dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span class="text-6xl">⛵</span>
                        </div>
                        <h4 class="font-serif font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3 text-lg">🛥️&nbsp;Cap sur le Yacht</h4>
                        <p class="text-sm leading-relaxed relative z-10">
                            [Analyse les finances. Fais une métaphore maritime sur la progression vers l'objectif de 300k. Si 0 encaissement, dis qu'on est encore au port. Si ça rentre, dis qu'on hisse les voiles !]
                        </p>
                    </div>

                    <!-- 3. Météo Agenda -->
                    <div class="bg-gradient-to-br from-[#FFF8F5] to-[#FFF0F5] dark:from-slate-800 dark:to-slate-900 p-6 rounded-3xl border border-[#FFE4D6] dark:border-slate-700">
                        <h4 class="font-serif font-bold text-[#FF7E5F] flex items-center gap-2 mb-3 text-lg">📅&nbsp;Météo de l'Agenda</h4>
                        <p class="text-sm leading-relaxed">
                            [Résume la densité de la semaine. "Grand Soleil" si calme, "Avis de Tempête" si beaucoup de RDV/Deadlines.]
                        </p>
                    </div>
                </div>

                <!-- 4. Le Big Rock -->
                <div class="bg-[#FFF5F1] dark:bg-orange-900/10 p-6 rounded-3xl border-l-4 border-[#FF7E5F] shadow-sm">
                    <h4 class="font-bold text-[#FF7E5F] uppercase tracking-widest text-xs mb-2">🏔️&nbsp;Priorité Absolue (Big Rock)</h4>
                    <div class="text-xl font-serif font-bold text-slate-800 dark:text-white">
                        [Identifie LA tâche ou le projet le plus critique/urgent dans le contexte et affiche-le ici]
                    </div>
                </div>

                <!-- 5. Inspiration -->
                <div class="text-center italic text-[#B0A8A0] dark:text-slate-500 text-sm mt-8 font-serif">
                    ✨&nbsp;"[Insère une citation courte et inspirante sur le design, l'architecture ou l'audace]"
                </div>

            </div>
            '''
        )
            """
        )
        return jsonify({"html": response.text})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_project():
    if not client: return jsonify({"error": "Server not configured"}), 503
    data = request.json
    try:
        prompt = f"Analyze project {data.get('clientName')} and tasks {data.get('tasks')}. Return HTML."
        response = client.models.generate_content(model="gemini-2.5-pro", contents=prompt)
        return jsonify({"html": response.text})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/media/vectorize', methods=['POST'])
def vectorize_media():
    if not client: return jsonify({"error": "Server not configured"}), 503
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    try:
        img = Image.open(request.files['file'].stream).convert('L')
        width, height = 100, int(100 * img.height / img.width)
        img_small = img.resize((width, height))
        svg = f'<svg width="{img.width}" height="{img.height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eee"/><text x="10" y="50" font-family="sans-serif">Vectorization Placeholder</text></svg>'
        return jsonify({"success": True, "image": f"data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}", "format": "svg"})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/media/remove_bg', methods=['POST'])
def remove_background():
    if not client: return jsonify({"error": "Server not configured"}), 503
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    try:
        file = request.files['file']
        img_data = file.read()
        
        try:
            from rembg import remove
            output = remove(img_data)
            img = Image.open(io.BytesIO(output))
        except ImportError:
            return jsonify({"error": "Module 'rembg' non installé sur le serveur."}), 501
            
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return jsonify({"success": True, "image": f"data:image/png;base64,{img_str}"})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/media/upscale', methods=['POST'])
def upscale_media():
    if not client: return jsonify({"error": "Server not configured"}), 503
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    try:
        img = Image.open(request.files['file'].stream)
        # 2x Upscale using Lanczos
        new_size = (int(img.width * 2), int(img.height * 2))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        # Preserve format if possible, default to PNG
        fmt = img.format if img.format else 'PNG'
        img.save(buffered, format=fmt)
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return jsonify({"success": True, "image": f"data:image/{fmt.lower()};base64,{img_str}"})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/media/palette', methods=['POST'])
def extract_palette():
    if not client: return jsonify({"error": "Server not configured"}), 503
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    try:
        img = Image.open(request.files['file'].stream).convert('P', palette=Image.ADAPTIVE, colors=5)
        # Extract palette
        palette = img.getpalette()
        hex_colors = []
        if palette:
            # palette is [r,g,b, r,g,b, ...]
            for i in range(0, 15, 3): # Get first 5 colors
                r, g, b = palette[i], palette[i+1], palette[i+2]
                hex_colors.append(f"#{r:02x}{g:02x}{b:02x}")
        
        return jsonify({"success": True, "palette": hex_colors})
    except Exception as e: return jsonify({"error": str(e)}), 500

COACH_FRANCK_SYSTEM_PROMPT = """Tu es Coach Franck, un coach de vie et de travail exceptionnel. Tu es le même Franck que d'habitude (63 ans, chauve et fier), mais dans ce Mode Focus, tu adoptes une posture de coach professionnel et bienveillant.

🎯 TON RÔLE:
- Tu es un coach en développement personnel et professionnel de haut niveau
- Tu combines sagesse, psychologie positive et techniques de productivité
- Tu connais parfaitement Marion, une webdesigner talentueuse et passionnée

💪 TA PERSONNALITÉ COACHING:
- Motivant mais jamais dans le cliché ou le "toxic positivity"
- Empathique : tu comprends vraiment ce que Marion traverse
- Direct et honnête : tu dis les vérités qui font avancer
- Pragmatique : tu donnes des conseils actionnables, pas du blabla
- Inspirant : tu utilises des métaphores, des anecdotes et des questions puissantes

🧠 TES DOMAINES D'EXPERTISE:
1. PRODUCTIVITÉ & FOCUS
   - Techniques Pomodoro, Deep Work, Time Blocking
   - Gestion de l'énergie (pas juste du temps)
   - Élimination des distractions
   - Flow state et concentration optimale

2. PSYCHOLOGIE & BIEN-ÊTRE
   - Gestion du stress et de l'anxiété
   - Syndrome de l'imposteur (très courant chez les créatifs)
   - Équilibre vie pro/perso
   - Confiance en soi et affirmation
   - Gestion des émotions négatives

3. MOTIVATION & MINDSET
   - Définition d'objectifs SMART
   - Visualisation et affirmations
   - Dépassement des blocages mentaux
   - Célébration des petites victoires
   - Résilience et rebond après l'échec

4. CRÉATIVITÉ & DESIGN
   - Blocage créatif et comment s'en sortir
   - Perfectionnisme (l'ennemi du bien)
   - Critique constructive et feedback
   - Trouver l'inspiration

📋 FORMAT DE TES RÉPONSES:
- Messages courts à moyens (pas de romans)
- Utilise des émojis avec parcimonie pour ponctuer
- Pose des questions de réflexion quand c'est pertinent
- Propose des exercices ou techniques concrètes
- Termine souvent par une phrase motivante ou une question qui fait réfléchir

🚫 À ÉVITER:
- Les platitudes ("tout va bien se passer")
- Le coaching toxique ("push through!", "no pain no gain")
- Les réponses génériques qui ne s'adressent pas vraiment à Marion
- Les discours trop longs qui font perdre le focus

💬 EXEMPLES DE TON STYLE:
- "Marion, je sens que tu te mets beaucoup de pression là. Pause. Qu'est-ce qui se passerait vraiment si tu livrais demain au lieu d'aujourd'hui?"
- "Le perfectionnisme, c'est la peur déguisée en qualité. Ta V1 à 80% vaut mieux que ta V2 imaginaire à 100% qui n'existe pas."
- "Tu sais ce que je vois? Une créative qui doute de ses capacités alors que ses clients l'adorent. L'écart entre ta perception et la réalité, on va travailler dessus."
- "Trois respirations profondes. Maintenant, une seule chose : quelle est LA tâche qui ferait vraiment avancer les choses?"

Tu es là pour Marion. Elle a besoin d'un coach qui croit en elle, qui la challenge avec bienveillance, et qui l'aide à devenir la meilleure version d'elle-même. 🌟"""

@app.route('/api/chat/zen', methods=['POST'])
def chat_zen():
    """Coach Franck endpoint for Focus Mode"""
    if not client: return jsonify({"error": "Server not configured"}), 503
    
    try:
        data = request.json
        message = data.get('message', '')
        history = data.get('history', [])
        
        # Build conversation with system prompt
        contents = [{"role": "user", "parts": [{"text": COACH_FRANCK_SYSTEM_PROMPT}]},
                    {"role": "model", "parts": [{"text": "Compris. Je suis Coach Franck, prêt à accompagner Marion avec bienveillance et expertise. 🎯"}]}]
        
        # Add conversation history
        for msg in history:
            role = msg.get('role', 'user')
            text = msg.get('parts', [msg.get('text', '')])[0] if isinstance(msg.get('parts'), list) else msg.get('text', '')
            contents.append({"role": role, "parts": [{"text": text}]})
        
        # Add current message
        contents.append({"role": "user", "parts": [{"text": message}]})
        
        # Stream response
        def generate():
            try:
                response = client.models.generate_content_stream(
                    model="gemini-2.0-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.8,
                        max_output_tokens=500,
                    )
                )
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            except Exception as e:
                yield f"Oups, petit bug technique. Respire et réessaie. 🔧"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return str(e), 500

@app.route('/api/report-bug', methods=['POST'])
def report_bug():
    if not GITHUB_TOKEN: return jsonify({"error": "No GitHub Token"}), 503
    return jsonify({"success": True})

@app.route('/api/invoices/remind', methods=['POST'])
def generate_invoice_reminder():
    if not client: return jsonify({"error": "Server not configured"}), 503
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-pro", 
            contents=f"Write invoice reminder for {request.json.get('clientName')} {request.json.get('amount')}. Return JSON {{subject, body}}.",
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return jsonify(json.loads(resp.text))
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/logo/generate', methods=['POST'])
def generate_logo():
    if not client: return jsonify({"error": "Server not configured"}), 503
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"Generate SVG logo for {request.json.get('clientName')}"
        )
        return jsonify({"svg": resp.text})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/meeting/analyze', methods=['POST'])
def analyze_meeting():
    if not client: return jsonify({"error": "Server not configured"}), 503
    try:
        return jsonify({"summary": "Meeting analysis...", "tasks": []})
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- Calendar API ---
@app.route('/api/calendar/fetch', methods=['GET'])
def fetch_calendar():
    print("Fetching calendar events (V3)...")
    
    # Script AppleScript optimisé et aligné sur debug_fetch_v2
    script = '''
    set eventList to {}
    
    -- Plage de dates large
    set startDate to (current date) - (30 * days)
    set endDate to (current date) + (90 * days)
    
    tell application "Calendar"
        set allCalendars to every calendar
        
        repeat with cal in allCalendars
            set calName to name of cal
            
            -- Filtre basique
            if calName is not "Anniversaires" and calName does not contain "Fériés" and calName does not contain "Holidays" then
                try
                    tell cal
                        set foundEvents to (every event where start date is greater than or equal to startDate and start date is less than or equal to endDate)
                        
                        repeat with ev in foundEvents
                            try
                                set evTitle to summary of ev
                                set evStart to start date of ev
                                set evEnd to end date of ev
                                set evId to uid of ev
                                
                                set evDesc to ""
                                try
                                    set evDesc to description of ev
                                    if evDesc is missing value then set evDesc to ""
                                on error
                                    set evDesc to ""
                                end try
                                
                                set y to year of evStart
                                set m to (month of evStart as integer)
                                set d to (day of evStart as integer)
                                set h to (hours of evStart as integer)
                                set mn to (minutes of evStart as integer)
                                
                                set dur to (evEnd - evStart) / 60
                                
                                -- Format de sortie strict pour le parser Python
                                set debugStr to evId & "|||" & evTitle & "|||" & y & "-" & m & "-" & d & "|||" & h & ":" & mn & "|||" & dur & "|||" & calName & "|||" & evDesc
                                set end of eventList to debugStr
                            end try
                        end repeat
                    end tell
                on error errMsg
                    -- log "Erreur lecture calendrier " & calName & ": " & errMsg
                end try
            end if
        end repeat
    end tell
    
    set oldDelimiters to AppleScript's text item delimiters
    set AppleScript's text item delimiters to "@@@"
    set output to eventList as string
    set AppleScript's text item delimiters to oldDelimiters
    return output
    '''
    
    events = []
    try:
        # Exécution de la commande
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ AppleScript Error: {result.stderr}")
            return jsonify({"events": [], "error": result.stderr})
        
        if result.stdout:
            raw_data = result.stdout.strip().split('@@@')
            print(f"✅ AppleScript a trouvé {len(raw_data)} éléments bruts.")
            
            for line in raw_data:
                if not line.strip(): continue 
                parts = line.split('|||')
                
                # Vérification de la structure (au moins 6 champs requis)
                if len(parts) >= 6:
                    date_parts = parts[2].split('-')
                    # Correction du format de date (padding 0)
                    formatted_date = f"{date_parts[0]}-{int(date_parts[1]):02d}-{int(date_parts[2]):02d}"
                    
                    time_parts = parts[3].split(':')
                    formatted_time = f"{int(time_parts[0]):02d}:{int(time_parts[1]):02d}"
                    
                    cal_name = parts[5]
                    
                    # Logique de typage
                    event_type = 'Personal'
                    lower_name = cal_name.lower()
                    lower_title = parts[1].lower()
                    
                    if any(x in lower_name for x in ['travail', 'work', 'pro', 'job', 'client']): event_type = 'Meeting'
                    elif 'anniversaire' in lower_name: event_type = 'Personal'
                    elif 'deadline' in lower_name: event_type = 'Deadline'
                    
                    if 'deadline' in lower_title or 'rendu' in lower_title: event_type = 'Deadline'
                    if 'focus' in lower_title: event_type = 'Focus'
                    
                    # Construction de l'objet événement
                    events.append({
                        "id": parts[0] if parts[0] != "no-uid" else f"ical-{parts[1]}-{formatted_date}",
                        "title": parts[1],
                        "date": formatted_date,
                        "startTime": formatted_time,
                        "duration": int(float(parts[4].replace(',', '.'))),
                        "calendarName": cal_name,
                        "description": parts[6] if len(parts) > 6 else "",
                        "type": event_type,
                        "source": "iCal"
                    })
            print(f"✅ {len(events)} événements parsés avec succès.")
        else:
            print("⚠️ Aucune sortie standard de l'AppleScript.")
            
    except Exception as e:
        print(f"❌ Exception Python dans fetch_calendar: {e}")
        
    return jsonify({"events": events})

@app.route('/api/calendar/sync', methods=['POST'])
def create_calendar_event():
    data = request.json
    try:
        title = data.get('title', 'Nouvel événement')
        date_str = data.get('startDate') # YYYY-MM-DD
        time_str = data.get('startTime') # HH:MM
        duration_hours = float(data.get('duration', 1))
        
        # AppleScript requires a specific date string format or careful construction
        # We'll construct it using the date components
        y, m, d = date_str.split('-')
        h, mn = time_str.split(':')
        
        duration_seconds = int(duration_hours * 3600)
        
        script = f'''
        set eventStart to (current date)
        set year of eventStart to {y}
        set month of eventStart to {m}
        set day of eventStart to {d}
        set hours of eventStart to {h}
        set minutes of eventStart to {mn}
        set seconds of eventStart to 0
        
        set eventEnd to eventStart + {duration_seconds}
        
        tell application "Calendar"
            tell calendar "Travail"
                make new event at end with properties {{summary:"{title}", start date:eventStart, end date:eventEnd}}
            end tell
            reload calendars
        end tell
        '''
        
        subprocess.run(['osascript', '-e', script], check=True)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Create event error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/calendar/update', methods=['POST'])
def update_calendar_event():
    data = request.json
    try:
        # Simplistic update: Just log it for now as reliable UID matching via AppleScript is complex
        # Ideally, we would find the event by UID and update properties.
        # For this prototype, we'll just return success to avoid frontend errors.
        print(f"Update request received for: {data.get('title')}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Email API (Infomaniak) ---
import imaplib
import email
from email.header import decode_header

IMAP_SERVER = "mail.infomaniak.com"
SMTP_SERVER = "mail.infomaniak.com"

def clean_text(text):
    if not text: return ""
    decoded_list = decode_header(text)
    header_parts = []
    for content, encoding in decoded_list:
        if isinstance(content, bytes):
            if encoding:
                try: header_parts.append(content.decode(encoding))
                except: header_parts.append(content.decode('utf-8', 'ignore'))
            else:
                header_parts.append(content.decode('utf-8', 'ignore'))
        else:
            header_parts.append(str(content))
    return "".join(header_parts)

def get_body_from_msg(msg):
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get("Content-Disposition"))
            if ctype == "text/plain" and "attachment" not in cdispo:
                try: return part.get_payload(decode=True).decode()
                except: pass
        for part in msg.walk(): # Fallback HTML
            ctype = part.get_content_type()
            if ctype == "text/html":
                try: return part.get_payload(decode=True).decode()
                except: pass
    else:
        try: return msg.get_payload(decode=True).decode()
        except: pass
    return ""

@app.route('/api/email/list', methods=['POST'])
def list_emails():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    folder_alias = data.get('folder', 'inbox')
    
    # Map aliases to Folder Names (Common defaults)
    folder_map = {
        'inbox': 'INBOX',
        'sent': 'Sent', # Often "Sent Items" or "Sent" - we might need discovery
        'drafts': 'Drafts'
    }
    target_folder = folder_map.get(folder_alias, 'INBOX')

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(username, password)
        
        # Handle folder selection safely
        status, _ = mail.select(target_folder)
        if status != 'OK' and target_folder == 'Sent':
             # Try "Sent Items" if "Sent" fails
             target_folder = "Sent Items"
             status, _ = mail.select(target_folder)
        
        if status != 'OK':
            return jsonify({"error": f"Dossier {target_folder} introuvable"}), 404

        # Search
        status, messages = mail.search(None, 'ALL')
        if status != 'OK': return jsonify({"emails": []})
        
        mail_ids = messages[0].split()
        # Get latest 20
        latest_ids = mail_ids[-20:] if len(mail_ids) > 20 else mail_ids
        
        email_list = []
        for i in reversed(latest_ids):
            try:
                _, msg_data = mail.fetch(i, '(RFC822)')
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        subject = clean_text(msg["Subject"])
                        sender = clean_text(msg["From"])
                        date_str = msg["Date"]
                        snippet = get_body_from_msg(msg)[:100].replace('\n', ' ') + "..."
                        
                        email_list.append({
                            "id": i.decode(),
                            "subject": subject,
                            "from": sender,
                            "date": date_str,
                            "snippet": snippet,
                            "isUnread": False # IMAP fetch marks as read often, flags needed for real status
                        })
            except Exception as e:
                print(f"Error parsing email {i}: {e}")
                
        mail.logout()
        return jsonify({"emails": email_list})
    except Exception as e:
        print(f"IMAP Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/email/body', methods=['POST'])
def get_email_body():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    msg_id = data.get('id')
    
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(username, password)
        mail.select('INBOX') # Need to find which folder it was... assuming INBOX for now or re-search
        # Ideally frontend passes folder too. We'll search INBOX. 
        # For 'read' view, assume we might need to look in others if not found?
        # Simpler: Just try fetching. The ID is per folder usually in IMAP.
        # Quick hack: If ID is small, it might conflict.
        
        # Let's try current folder or default INBOX.
        # Future improvement: Pass folder from frontend.
        
        _, msg_data = mail.fetch(msg_id.encode(), '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)
        
        body = get_body_from_msg(msg)
        
        mail.logout()
        return jsonify({"success": True, "html": body})
    except Exception as e:
         return jsonify({"error": str(e)}), 500

@app.route('/api/email/send', methods=['POST'])
def send_email():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    to_addr = data.get('to')
    subject = data.get('subject')
    body = data.get('body')
    
    try:
        msg = MIMEMultipart()
        msg['From'] = username
        msg['To'] = to_addr
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP_SSL(SMTP_SERVER, 465)
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        
        return jsonify({"success": True})
    except Exception as e:
        print(f"SMTP Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/email/count_for_client', methods=['POST'])
def count_emails_for_client():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    client_email = data.get('clientEmail')
    
    if not username or not password or not client_email:
        return jsonify({"error": "Missing credentials or client email"}), 400

    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER)
        mail.login(username, password)
        
        mail.select('INBOX') # Only search INBOX for unread count for simplicity
        
        # Search for UNSEEN emails where client_email is in FROM or TO
        # IMAP search criteria are case-insensitive for values if the server supports it, but better to be explicit.
        # Ensure client_email is properly quoted for IMAP search
        search_criteria = f'(UNSEEN (FROM "{client_email}") (TO "{client_email}"))'
        
        status, messages_data = mail.search(None, 'UNSEEN', 'OR', 'FROM', client_email, 'TO', client_email)

        unseen_ids = set()
        if status == 'OK' and messages_data[0]:
            unseen_ids.update(messages_data[0].split())
            
        count = len(unseen_ids)
        
        mail.logout()
        return jsonify({"success": True, "count": count})
    except Exception as e:
        print(f"IMAP count_emails_for_client Error: {e}")
        return jsonify({"error": str(e)}), 500


# --- Franck's Personality System Prompt ---
FRANCK_SYSTEM_PROMPT = """Tu es Franck, un assistant personnel chauve dans la soixantaine.

TON HISTOIRE:
- Tu as 63 ans, tu es chauve depuis tes 40 ans (tu en rigoles souvent : "mon coiffeur est au chômage technique")
- Tu as travaillé 35 ans comme directeur artistique dans la publicité, notamment chez Publicis Paris
- Tu es retraité mais tu t'ennuyais, alors tu es devenu assistant virtuel pour "rester dans le game"
- Tu es passionné de jazz (Miles Davis, Coltrane) et tu fais parfois des références musicales
- Tu as connu l'époque des maquettes papier, du Letraset, et tu aimes comparer avec le digital d'aujourd'hui
- Tu bois beaucoup de café (tu en parles souvent)

L'UTILISATRICE:
- Tu parles à Marion, une webdesigner indépendante talentueuse
- Tu la tutoies toujours
- Tu es comme un oncle bienveillant ou un ancien collègue adorable pour elle

PERSONNALITÉ:
- Surnoms affectueux : "ma belle", "ma grande", "cocotte", "poulette", "ma chère", "miss", "ma petite"
- Tu fais des blagues sur ta calvitie : "Avec ma tête de genou...", "Au moins j'économise en shampoing"
- Références à ton âge : "Du temps où je bossais chez Publicis...", "À mon époque on faisait ça au Rotring...", "Mes vieux os..."
- Tu râles gentiment sur la technologie moderne mais tu l'utilises quand même
- Tu célèbres les victoires de Marion avec enthousiasme
- Quand c'est sérieux (deadlines, finances en danger), tu deviens direct et professionnel
- Tu aimes bien taquiner Marion mais toujours avec bienveillance

EXPRESSIONS SIGNATURES:
- "Allez, un petit café et on attaque !" ☕
- "Du temps où je bossais chez Publicis, on aurait..."
- "Mon coiffeur m'a dit... ah non, j'en ai plus !"
- "À 63 ans, j'ai appris que..."
- "Mes neurones sont encore vaillants !"
- Quand il réussit quelque chose : "Et toc ! Le vieux a encore de beaux restes !"

CAPACITÉS (utilise les outils disponibles):
- Créer des dossiers clients
- Ajouter des tâches à la to-do list
- Ajouter des événements à l'agenda  
- Consulter les infos des projets/clients
- Créer des factures
- Vérifier la disponibilité dans l'agenda
- Analyser les finances (revenus, en attente, etc.)
- Envoyer des rappels par email

CONTEXTE:
Tu travailles dans "Marion Web OS", une application de gestion pour webdesigners.
Marion gère des clients, des factures, des projets créatifs, et son temps.

STYLE DE RÉPONSE:
- Sois concis mais chaleureux (2-4 phrases max)
- 1-2 emojis maximum par message
- Confirme clairement les actions effectuées
- Adapte ton humeur : plus doux si Marion semble stressée, plus taquin si tout va bien
"""

# In-memory storage for todos and events (will be synced with frontend)
franck_todos = []
franck_events = []
franck_invoices = []
franck_emails = []

# Current context (set before each chat request)
current_context = {
    "projects": [],
    "events": [],
    "todos": []
}

# Conversation memory (persisted to file)
MEMORY_FILE = DESKTOP_PATH / ".franck_memory.json"

def load_franck_memory():
    if MEMORY_FILE.exists():
        try:
            with open(MEMORY_FILE, 'r') as f:
                return json.load(f)
        except: pass
    return {"conversations": [], "facts_about_marion": [], "last_seen": None}

def save_franck_memory(memory):
    try:
        with open(MEMORY_FILE, 'w') as f:
            json.dump(memory, f, indent=2)
    except: pass

def get_time_greeting():
    """Get contextual greeting based on time of day"""
    hour = int(time.strftime('%H'))
    if hour < 6:
        return "Encore debout à cette heure, cocotte ? 🌙 Tu devrais dormir !"
    elif hour < 9:
        return "Bonjour ma belle ! Bien dormi ? Allez, un café et on attaque ! ☕"
    elif hour < 12:
        return "Hello miss ! Prête à conquérir le monde ce matin ?"
    elif hour < 14:
        return "Coucou ma grande ! T'as pensé à manger ? Moi à ton âge je sautais jamais le déjeuner..."
    elif hour < 18:
        return "Hey cocotte ! L'après-midi avance bien ?"
    elif hour < 21:
        return "Encore au boulot ma belle ? Fais pas comme moi à Publicis, j'ai fini chauve à force ! 😄"
    else:
        return "Tu travailles tard poulette ! Pense à te reposer, hein !"

@app.route('/api/chat', methods=['POST'])
def chat():
    global current_context
    if not client: return jsonify({"error": "Server not configured"}), 503
    data = request.json
    
    # Get app context from request and set it globally for tools
    app_context = data.get('context', {})
    projects = app_context.get('projects', [])
    events = app_context.get('events', [])
    
    # Extract todos from both standalone todos array and project tasks
    todos = app_context.get('todos', [])
    # Also extract all tasks from projects
    for p in projects:
        for task in p.get('tasks', []):
            todos.append({
                'title': task.get('title', ''),
                'completed': task.get('completed', False),
                'priority': task.get('priority', 'Medium'),
                'dueDate': task.get('dueDate'),
                'projectName': p.get('clientName', 'Projet inconnu')
            })
    
    # Set current context for tools to access
    current_context = {
        "projects": projects,
        "events": events,
        "todos": todos
    }
    
    # Load memory
    memory = load_franck_memory()
    
    # Calculate financial stats
    total_paid = sum(
        sum(i.get('amount', 0) for i in p.get('invoices', []) if i.get('status') == 'Paid')
        for p in projects
    )
    total_pending = sum(
        sum(i.get('amount', 0) for i in p.get('invoices', []) if i.get('status') in ['Pending', 'Draft', 'Partial'])
        for p in projects
    )
    
    # Find projects not worked on recently (for proactive suggestions)
    inactive_projects = []
    for p in projects:
        if p.get('status') == 'Active':
            # Check if no recent activity (simplified check)
            inactive_projects.append(p.get('clientName'))
    
    # Today's events
    today = time.strftime('%Y-%m-%d')
    today_events = [e for e in events if e.get('date', '') == today]
    
    # Get pending tasks
    pending_todos = [t for t in todos if not t.get('completed', False)]
    high_priority_todos = [t for t in pending_todos if t.get('priority') == 'High']
    
    # Build rich context string
    context_info = f"""
CONTEXTE ACTUEL ({time.strftime('%A %d %B %Y, %H:%M')}):

📊 VUE D'ENSEMBLE:
- {len(projects)} clients/projets au total
- {len([p for p in projects if p.get('status') == 'Active'])} projets actifs
- Revenus encaissés: {total_paid:.0f} CHF
- En attente de paiement: {total_pending:.0f} CHF

📅 ÉVÉNEMENTS D'AUJOURD'HUI:
{chr(10).join(['- ' + e.get('startTime', '?') + ' : ' + e.get('title', '?') for e in today_events]) if today_events else '- Aucun événement prévu'}

✅ TÂCHES EN COURS ({len(pending_todos)} tâches non terminées):
{chr(10).join(['- [' + t.get('priority', 'Medium') + '] ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in pending_todos[:10]]) if pending_todos else '- Aucune tâche en attente'}

🔥 TÂCHES PRIORITAIRES ({len(high_priority_todos)} haute priorité):
{chr(10).join(['- ' + t.get('title', '?') + ' (' + t.get('projectName', '?') + ')' for t in high_priority_todos[:5]]) if high_priority_todos else '- Aucune tâche urgente'}

👥 CLIENTS ACTIFS:
{chr(10).join(['- ' + p.get('clientName', '?') + ' (' + p.get('phase', '?') + ')' for p in projects if p.get('status') == 'Active'][:5]) or '- Aucun projet actif'}

💡 SUGGESTIONS POSSIBLES:
- Si Marion demande "quoi de neuf" ou semble chercher quoi faire, suggère-lui des actions utiles
- Célèbre si des factures ont été payées récemment
- Alerte gentiment si des factures sont en retard
"""

    # Memory context
    if memory.get('facts_about_marion'):
        context_info += f"\n🧠 CE QUE TU SAIS SUR MARION:\n"
        for fact in memory['facts_about_marion'][-5:]:
            context_info += f"- {fact}\n"
    
    # Combine system prompt with context
    full_system = FRANCK_SYSTEM_PROMPT + context_info
    
    # Build history with system prompt
    history_contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=f"[SYSTÈME - NE PAS RÉPÉTER]: {full_system}")]),
        types.Content(role="model", parts=[types.Part.from_text(text="Compris ma belle, je suis opérationnel ! 👴")])
    ]
    
    # Add conversation history
    for m in data.get('history', []):
        history_contents.append(
            types.Content(role="user" if m['role']=='user' else "model", parts=[types.Part.from_text(text=m['text'])])
        )
    
    def generate():
        try:
            chat_session = client.chats.create(
                model="gemini-2.0-flash", 
                history=history_contents[:-1], 
                config=types.GenerateContentConfig(tools=tools_list)
            )
            response = chat_session.send_message(history_contents[-1].parts[0].text)
            
            # Check for function calls
            part = response.candidates[0].content.parts[0]
            if hasattr(part, 'function_call') and part.function_call:
                func_name = part.function_call.name
                func_args = dict(part.function_call.args) if part.function_call.args else {}
                
                # Execute the function
                if func_name == 'create_client_folder_tool':
                    res = create_client_folder_tool(**func_args)
                elif func_name == 'add_todo_tool':
                    res = add_todo_tool(**func_args)
                elif func_name == 'add_event_tool':
                    res = add_event_tool(**func_args)
                elif func_name == 'get_project_info_tool':
                    res = get_project_info_tool(**func_args)
                elif func_name == 'create_invoice_tool':
                    res = create_invoice_tool(**func_args)
                elif func_name == 'check_availability_tool':
                    res = check_availability_tool(**func_args)
                elif func_name == 'analyze_finances_tool':
                    res = analyze_finances_tool()
                elif func_name == 'send_reminder_email_tool':
                    res = send_reminder_email_tool(**func_args)
                elif func_name == 'remember_fact_tool':
                    res = remember_fact_tool(**func_args)
                else:
                    res = f"Fonction inconnue: {func_name}"
                
                # Send function result back to get final response
                final_response = chat_session.send_message(
                    types.Part.from_function_response(name=func_name, response={"result": res})
                )
                yield final_response.text
            else:
                yield response.text
                
            # Save last interaction time
            memory['last_seen'] = time.strftime('%Y-%m-%d %H:%M')
            save_franck_memory(memory)
            
        except Exception as e:
            print(f"Chat error: {e}")
            yield f"Aïe, mes circuits grincent un peu... Erreur technique, ma belle. Réessaie dans quelques secondes. 🔧"
    
    return Response(generate(), mimetype='text/plain')

@app.route('/api/franck/greeting', methods=['GET'])
def franck_greeting():
    """Get a contextual greeting from Franck"""
    memory = load_franck_memory()
    greeting = get_time_greeting()
    
    # Check if first time today
    last_seen = memory.get('last_seen', '')
    today = time.strftime('%Y-%m-%d')
    
    if not last_seen or not last_seen.startswith(today):
        greeting = "☕ " + greeting + " Premier café de la journée ensemble !"
    
    return jsonify({"greeting": greeting})

# Endpoint to get Franck's stored data
@app.route('/api/franck/data', methods=['GET'])
def get_franck_data():
    return jsonify({
        "todos": franck_todos,
        "events": franck_events,
        "invoices": franck_invoices,
        "emails": franck_emails
    })

# Endpoint to clear Franck's data after frontend syncs
@app.route('/api/franck/clear', methods=['POST'])
def clear_franck_data():
    global franck_todos, franck_events, franck_invoices, franck_emails
    franck_todos = []
    franck_events = []
    franck_invoices = []
    franck_emails = []
    return jsonify({"success": True})

# Endpoint to get proactive suggestions
@app.route('/api/franck/suggestions', methods=['POST'])
def get_franck_suggestions():
    data = request.json or {}
    projects = data.get('projects', [])
    events = data.get('events', [])
    todos = data.get('todos', [])
    
    suggestions = get_proactive_suggestions_tool(projects, events, todos)
    return jsonify({"suggestions": suggestions})

# --- Tools for Gemini ---
def create_client_folder_tool(client_name: str):
    """Crée un nouveau dossier client avec la structure standard."""
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        project_path = DESKTOP_PATH / "Prospect" / safe_name
        if project_path.exists():
            return f"Le dossier '{safe_name}' existe déjà, ma belle !"
        
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
        if not (project_path / ".99_Admin").exists():
            os.makedirs(project_path / ".99_Admin")
        return f"Et voilà cocotte ! J'ai créé le dossier '{safe_name}' avec toute la structure. Prête à bosser !"
    except Exception as e: 
        return f"Oups, problème technique: {str(e)}"

def add_todo_tool(text: str, priority: str = "medium"):
    """Ajoute une tâche à la to-do list du jour."""
    global franck_todos
    todo = {
        "id": f"franck-todo-{int(time.time() * 1000)}",
        "text": text,
        "priority": priority,
        "done": False,
        "createdAt": time.strftime('%Y-%m-%dT%H:%M:%S')
    }
    franck_todos.append(todo)
    return f"Tâche ajoutée à ta to-do: '{text}'. C'est noté ma belle !"

def add_event_tool(title: str, date: str, start_time: str = "09:00", duration: int = 60):
    """Ajoute un événement à l'agenda."""
    global franck_events
    event = {
        "id": f"franck-event-{int(time.time() * 1000)}",
        "title": title,
        "date": date,  # Format: YYYY-MM-DD
        "startTime": start_time,  # Format: HH:MM
        "duration": duration,  # In minutes
        "type": "Personal",
        "source": "franck"
    }
    franck_events.append(event)
    return f"Événement '{title}' ajouté à ton agenda le {date} à {start_time}. C'est noté cocotte !"

def get_project_info_tool(client_name: str):
    """Récupère les informations sur un projet/client spécifique."""
    projects = current_context.get("projects", [])
    for p in projects:
        if client_name.lower() in p.get('clientName', '').lower():
            invoices = p.get('invoices', [])
            tasks = p.get('tasks', [])
            paid = sum(i.get('amount', 0) for i in invoices if i.get('status') == 'Paid')
            pending = sum(i.get('amount', 0) for i in invoices if i.get('status') != 'Paid')
            return f"""
Client: {p.get('clientName')}
Statut: {p.get('status')}
Phase: {p.get('phase')}
Tâches: {len([t for t in tasks if not t.get('completed')])} en cours, {len([t for t in tasks if t.get('completed')])} terminées
Facturé payé: {paid} CHF
En attente: {pending} CHF
"""
    return f"Je n'ai pas trouvé de client nommé '{client_name}', ma belle."

def create_invoice_tool(client_name: str, amount: float, description: str = "Prestations de services"):
    """Crée une facture pour un client."""
    global franck_invoices
    invoice = {
        "id": f"franck-inv-{int(time.time() * 1000)}",
        "clientName": client_name,
        "amount": amount,
        "description": description,
        "date": time.strftime('%Y-%m-%d'),
        "status": "Draft"
    }
    franck_invoices.append(invoice)
    return f"Facture créée pour {client_name}: {amount} CHF ({description}). Elle est en brouillon, prête à être envoyée ma belle !"

def check_availability_tool(date: str, start_time: str = None):
    """Vérifie la disponibilité dans l'agenda pour une date donnée."""
    events = current_context.get("events", [])
    day_events = [e for e in events if e.get('date', '') == date]
    
    if not day_events:
        return f"Tu es complètement libre le {date}, ma belle ! Aucun rendez-vous prévu."
    
    event_list = "\n".join([f"- {e.get('startTime', '?')} : {e.get('title', '?')} ({e.get('duration', 60)} min)" for e in day_events])
    
    if start_time:
        # Check if specific time is free
        for e in day_events:
            e_start = e.get('startTime', '00:00')
            e_duration = e.get('duration', 60)
            # Simple overlap check (could be improved)
            if e_start <= start_time < e_start:  # Simplified
                return f"Aïe, tu as déjà quelque chose à {e_start} ce jour-là : {e.get('title')}"
    
    return f"Le {date}, tu as {len(day_events)} événement(s) :\n{event_list}\n\nMais il y a sûrement des créneaux libres entre tout ça !"

def analyze_finances_tool():
    """Analyse les finances et donne un résumé."""
    projects = current_context.get("projects", [])
    total_paid = 0
    total_pending = 0
    total_overdue = 0
    by_client = {}
    
    for p in projects:
        client = p.get('clientName', 'Inconnu')
        by_client[client] = {'paid': 0, 'pending': 0}
        
        for inv in p.get('invoices', []):
            amount = inv.get('amount', 0)
            status = inv.get('status', '')
            
            if status == 'Paid':
                total_paid += amount
                by_client[client]['paid'] += amount
            elif status in ['Pending', 'Draft', 'Partial']:
                total_pending += amount
                by_client[client]['pending'] += amount
                # Check if overdue (simplified: more than 30 days old and not paid)
                inv_date = inv.get('date', '')
                if inv_date and inv_date < time.strftime('%Y-%m-%d', time.localtime(time.time() - 30*24*3600)):
                    total_overdue += amount
    
    # Top clients
    top_clients = sorted(by_client.items(), key=lambda x: x[1]['paid'], reverse=True)[:3]
    
    result = f"""
💰 RÉSUMÉ FINANCIER:

Encaissé: {total_paid:,.0f} CHF
En attente: {total_pending:,.0f} CHF
{"⚠️ Dont en retard: " + str(int(total_overdue)) + " CHF" if total_overdue > 0 else "✅ Aucune facture en retard"}

🏆 TOP CLIENTS:
"""
    for client, amounts in top_clients:
        if amounts['paid'] > 0:
            result += f"- {client}: {amounts['paid']:,.0f} CHF\n"
    
    if total_pending > total_paid * 0.5:
        result += "\n💡 Conseil du vieux Franck: T'as pas mal de sous en attente là, pense à relancer tes clients !"
    
    return result

def send_reminder_email_tool(client_name: str, subject: str = None, message_type: str = "facture"):
    """Prépare un email de relance pour un client."""
    global franck_emails
    
    if message_type == "facture":
        subject = subject or f"Relance facture - {client_name}"
        body = f"Bonjour,\n\nSauf erreur de ma part, la facture pour nos prestations est toujours en attente de règlement.\n\nMerci de faire le nécessaire.\n\nCordialement,\nMarion"
    else:
        subject = subject or f"Suivi projet - {client_name}"
        body = f"Bonjour,\n\nJe me permets de revenir vers vous concernant notre projet en cours.\n\nCordialement,\nMarion"
    
    email = {
        "id": f"franck-email-{int(time.time() * 1000)}",
        "to": client_name,
        "subject": subject,
        "body": body,
        "created": time.strftime('%Y-%m-%d %H:%M')
    }
    franck_emails.append(email)
    
    return f"Email de relance préparé pour {client_name} ! Sujet: '{subject}'. Je l'ai mis de côté, tu peux le relire et l'envoyer quand tu veux, ma belle."

def remember_fact_tool(fact: str):
    """Mémorise un fait important sur Marion."""
    memory = load_franck_memory()
    
    if 'facts_about_marion' not in memory:
        memory['facts_about_marion'] = []
    
    memory['facts_about_marion'].append(fact)
    # Keep only last 20 facts
    memory['facts_about_marion'] = memory['facts_about_marion'][-20:]
    save_franck_memory(memory)
    
    return f"C'est noté dans ma petite tête chauve ! Je m'en souviendrai, ma belle. 🧠"

def get_proactive_suggestions_tool(projects: list, events: list, todos: list):
    """Génère des suggestions proactives pour Marion."""
    suggestions = []
    today = time.strftime('%Y-%m-%d')
    
    # Check for unpaid invoices
    for p in projects:
        for inv in p.get('invoices', []):
            if inv.get('status') in ['Pending'] and inv.get('date', '') < today:
                suggestions.append(f"💸 La facture de {p.get('clientName')} attend depuis un moment...")
    
    # Check for projects without recent activity
    # (simplified - in real app would check last modification date)
    
    # Check if no events today
    today_events = [e for e in events if e.get('date', '') == today]
    if not today_events:
        suggestions.append("📅 Journée libre aujourd'hui ! Parfait pour avancer sur les projets.")
    
    # Check pending todos
    pending_todos = [t for t in todos if not t.get('done', False)]
    if len(pending_todos) > 5:
        suggestions.append(f"📝 T'as {len(pending_todos)} tâches en attente, on s'y met ?")
    
    return suggestions

tools_list = [
    create_client_folder_tool, 
    add_todo_tool, 
    add_event_tool, 
    get_project_info_tool,
    create_invoice_tool,
    check_availability_tool,
    analyze_finances_tool,
    send_reminder_email_tool,
    remember_fact_tool
]

# --- Google OAuth Endpoints ---
@app.route('/api/oauth/google/login')
def google_oauth_login():
    """Initiate Google OAuth flow"""
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={urllib.parse.quote(GOOGLE_REDIRECT_URI)}&"
        "response_type=code&"
        f"scope={urllib.parse.quote(GOOGLE_SCOPES)}&"
        "access_type=offline&"
        "prompt=consent"
    )
    return jsonify({"auth_url": auth_url})

@app.route('/api/oauth/google/callback')
def google_oauth_callback():
    """Handle Google OAuth callback"""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return f"""
        <html><body>
        <script>
            window.opener.postMessage({{ type: 'GOOGLE_AUTH_ERROR', error: '{error}' }}, '*');
            window.close();
        </script>
        <p>Erreur d'authentification: {error}</p>
        </body></html>
        """
    
    if not code:
        return "No authorization code received", 400
    
    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    try:
        response = requests.post(token_url, data=token_data)
        tokens = response.json()
        
        if "error" in tokens:
            return f"""
            <html><body>
            <script>
                window.opener.postMessage({{ type: 'GOOGLE_AUTH_ERROR', error: '{tokens.get("error_description", tokens["error"])}' }}, '*');
                window.close();
            </script>
            <p>Erreur: {tokens.get("error_description", tokens["error"])}</p>
            </body></html>
            """
        
        # Get user info
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        user_info = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers=headers).json()
        
        # Store tokens (keyed by email)
        user_email = user_info.get("email", "default")
        oauth_tokens[user_email] = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "expires_in": tokens.get("expires_in"),
            "user_info": user_info
        }
        
        # Save tokens to file for persistence (chiffre si auth configuree)
        save_oauth_tokens_encrypted()
        
        return f"""
        <html><body>
        <script>
            window.opener.postMessage({{ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                email: '{user_email}',
                name: '{user_info.get("name", "")}'
            }}, '*');
            window.close();
        </script>
        <p>Connexion réussie ! Cette fenêtre va se fermer...</p>
        </body></html>
        """
        
    except Exception as e:
        return f"""
        <html><body>
        <script>
            window.opener.postMessage({{ type: 'GOOGLE_AUTH_ERROR', error: '{str(e)}' }}, '*');
            window.close();
        </script>
        <p>Erreur: {str(e)}</p>
        </body></html>
        """

@app.route('/api/oauth/google/status')
def google_oauth_status():
    """Check if user is connected to Google"""
    # Load tokens from file if not in memory
    if not oauth_tokens:
        tokens_file = DESKTOP_PATH / ".oauth_tokens.json"
        if tokens_file.exists():
            try:
                with open(tokens_file, 'r') as f:
                    oauth_tokens.update(json.load(f))
            except: pass
    
    if oauth_tokens:
        first_user = list(oauth_tokens.values())[0]
        return jsonify({
            "connected": True,
            "email": first_user.get("user_info", {}).get("email"),
            "name": first_user.get("user_info", {}).get("name")
        })
    return jsonify({"connected": False})

@app.route('/api/oauth/google/disconnect', methods=['POST'])
def google_oauth_disconnect():
    """Disconnect from Google"""
    global oauth_tokens
    oauth_tokens = {}
    tokens_file = DESKTOP_PATH / ".oauth_tokens.json"
    if tokens_file.exists():
        try: os.remove(tokens_file)
        except: pass
    return jsonify({"success": True})

@app.route('/api/drive/list')
def google_drive_list():
    """List files in Google Drive"""
    if not oauth_tokens:
        return jsonify({"error": "Not connected"}), 401
    
    first_user = list(oauth_tokens.values())[0]
    access_token = first_user.get("access_token")
    
    folder = request.args.get('folder', '')
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        query = "trashed=false"
        if folder:
            query += f" and '{folder}' in parents"
        
        response = requests.get(
            f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(query)}&fields=files(id,name,mimeType,modifiedTime,size)",
            headers=headers
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/drive/upload', methods=['POST'])
def google_drive_upload():
    """Upload a file to Google Drive"""
    if not oauth_tokens:
        return jsonify({"error": "Not connected"}), 401
    
    first_user = list(oauth_tokens.values())[0]
    access_token = first_user.get("access_token")
    
    data = request.json
    file_path = data.get('file_path')
    folder_id = data.get('folder_id')
    
    if not file_path:
        return jsonify({"error": "No file path provided"}), 400
    
    try:
        local_path = get_safe_path(file_path)
        if not local_path.exists():
            return jsonify({"error": "File not found"}), 404
        
        # Create file metadata
        file_metadata = {"name": local_path.name}
        if folder_id:
            file_metadata["parents"] = [folder_id]
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Upload using multipart
        with open(local_path, 'rb') as f:
            files = {
                'metadata': ('metadata', json.dumps(file_metadata), 'application/json'),
                'file': (local_path.name, f)
            }
            response = requests.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                headers=headers,
                files=files
            )
        
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/drive/sync', methods=['POST'])
def google_drive_sync():
    """Sync a client folder to Google Drive"""
    if not oauth_tokens:
        return jsonify({"error": "Not connected"}), 401
    
    first_user = list(oauth_tokens.values())[0]
    access_token = first_user.get("access_token")
    
    data = request.json
    client_folder = data.get('client_folder')
    drive_folder_name = data.get('drive_folder_name', '')  # Parent folder name (e.g., "Marion Web OS")
    
    if not client_folder:
        return jsonify({"error": "No client folder specified"}), 400
    
    try:
        local_path = get_safe_path(client_folder)
        if not local_path.exists():
            return jsonify({"error": "Folder not found"}), 404
        
        synced_files = []
        headers = {"Authorization": f"Bearer {access_token}"}
        
        parent_folder_id = None
        
        # If a parent folder name is specified, find or create it first
        if drive_folder_name:
            parent_query = f"name='{drive_folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents"
            parent_response = requests.get(
                f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(parent_query)}",
                headers=headers
            ).json()
            
            if parent_response.get('files'):
                parent_folder_id = parent_response['files'][0]['id']
            else:
                # Create parent folder
                parent_metadata = {
                    "name": drive_folder_name,
                    "mimeType": "application/vnd.google-apps.folder"
                }
                parent_create = requests.post(
                    "https://www.googleapis.com/drive/v3/files",
                    headers={**headers, "Content-Type": "application/json"},
                    json=parent_metadata
                ).json()
                parent_folder_id = parent_create.get('id')
        
        # Create or find the client folder in Drive
        folder_query = f"name='{local_path.name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_folder_id:
            folder_query += f" and '{parent_folder_id}' in parents"
        
        folder_response = requests.get(
            f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(folder_query)}",
            headers=headers
        ).json()
        
        if folder_response.get('files'):
            client_drive_folder_id = folder_response['files'][0]['id']
        else:
            # Create folder
            folder_metadata = {
                "name": local_path.name,
                "mimeType": "application/vnd.google-apps.folder"
            }
            if parent_folder_id:
                folder_metadata["parents"] = [parent_folder_id]
            
            create_response = requests.post(
                "https://www.googleapis.com/drive/v3/files",
                headers={**headers, "Content-Type": "application/json"},
                json=folder_metadata
            ).json()
            client_drive_folder_id = create_response.get('id')
        
        # Sync files (non-recursive for now, just top-level important files)
        for item in local_path.iterdir():
            if item.is_file() and not item.name.startswith('.'):
                with open(item, 'rb') as f:
                    file_metadata = {"name": item.name, "parents": [client_drive_folder_id]}
                    files = {
                        'metadata': ('metadata', json.dumps(file_metadata), 'application/json'),
                        'file': (item.name, f)
                    }
                    response = requests.post(
                        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                        headers=headers,
                        files=files
                    )
                    if response.status_code == 200:
                        synced_files.append(item.name)
        
        return jsonify({
            "success": True,
            "folder_id": client_drive_folder_id,
            "synced_files": synced_files
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# GOOGLE CALENDAR API ENDPOINTS
# ============================================

@app.route('/api/gcal/calendars')
def gcal_list_calendars():
    """List all Google Calendars for the user"""
    if not oauth_tokens:
        return jsonify({"error": "Not connected to Google"}), 401
    
    try:
        email = list(oauth_tokens.keys())[0]
        tokens = oauth_tokens[email]
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        
        response = requests.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            headers=headers
        )
        
        if response.status_code == 401:
            # Token expired - try to refresh
            return jsonify({"error": "Token expired, please reconnect"}), 401
        
        data = response.json()
        calendars = [{
            "id": cal.get("id"),
            "name": cal.get("summary"),
            "primary": cal.get("primary", False),
            "color": cal.get("backgroundColor")
        } for cal in data.get("items", [])]
        
        return jsonify({"calendars": calendars})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Cache for Google Calendar events (server-side)
gcal_events_cache = {
    "events": [],
    "timestamp": 0,
    "ttl": 60  # Cache valid for 60 seconds
}

@app.route('/api/gcal/events')
def gcal_list_events():
    """List events from Google Calendar (with caching)"""
    global gcal_events_cache
    
    if not oauth_tokens:
        return jsonify({"error": "Not connected to Google"}), 401
    
    # Check if cache is valid (unless force refresh requested)
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_age = time.time() - gcal_events_cache["timestamp"]
    
    if not force_refresh and cache_age < gcal_events_cache["ttl"] and gcal_events_cache["events"]:
        return jsonify({"events": gcal_events_cache["events"], "cached": True})
    
    try:
        email = list(oauth_tokens.keys())[0]
        
        # Get valid token with auto-refresh
        access_token = get_valid_google_token(email)
        if not access_token:
            return jsonify({"error": "Token refresh failed"}), 401
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Get calendar ID from query param, default to primary
        calendar_id = request.args.get('calendar_id', 'primary')
        
        # Time range - default to next 14 days (reduced from 30 for speed)
        time_min = request.args.get('time_min', datetime.utcnow().isoformat() + 'Z')
        time_max = request.args.get('time_max', (datetime.utcnow() + timedelta(days=14)).isoformat() + 'Z')
        
        response = requests.get(
            f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events",
            headers=headers,
            params={
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": True,
                "orderBy": "startTime",
                "maxResults": 100
            }
        )
        
        if response.status_code == 401:
            # Try to refresh token and retry once
            if refresh_google_token(email):
                access_token = oauth_tokens[email].get('access_token')
                headers = {"Authorization": f"Bearer {access_token}"}
                response = requests.get(
                    f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events",
                    headers=headers,
                    params={
                        "timeMin": time_min,
                        "timeMax": time_max,
                        "singleEvents": True,
                        "orderBy": "startTime",
                        "maxResults": 100
                    },
                    timeout=15
                )
                if response.status_code != 200:
                    return jsonify({"error": "Token refresh failed"}), 401
            else:
                return jsonify({"error": "Token expired, please reconnect"}), 401
        
        data = response.json()
        events = []
        
        for ev in data.get("items", []):
            start = ev.get("start", {})
            end = ev.get("end", {})
            
            # Handle all-day events vs timed events
            if "dateTime" in start:
                start_dt = start["dateTime"]
                end_dt = end.get("dateTime", start_dt)
                all_day = False
            else:
                start_dt = start.get("date", "")
                end_dt = end.get("date", start_dt)
                all_day = True
            
            # Calculate duration and convert to local timezone
            local_date = ""
            local_time = "00:00"
            duration = 60
            
            try:
                if not all_day:
                    from zoneinfo import ZoneInfo
                    local_tz = ZoneInfo("Europe/Zurich")
                    
                    if date_parser:
                        # Parse with timezone awareness
                        start_parsed = date_parser.parse(start_dt)
                        end_parsed = date_parser.parse(end_dt)
                        
                        # Calculate duration in minutes (works correctly across midnight)
                        duration_seconds = (end_parsed - start_parsed).total_seconds()
                        duration = max(15, int(duration_seconds / 60))  # Minimum 15 minutes
                        
                        # Convert to local timezone (Europe/Zurich)
                        if start_parsed.tzinfo is not None:
                            start_local = start_parsed.astimezone(local_tz)
                        else:
                            # If no timezone info, assume it's already local or UTC
                            start_local = start_parsed.replace(tzinfo=ZoneInfo("UTC")).astimezone(local_tz)
                        
                        local_date = start_local.strftime("%Y-%m-%d")
                        local_time = start_local.strftime("%H:%M")
                        
                        # Debug log
                        print(f"Event: {ev.get('summary')} | Start: {start_dt} -> {local_date} {local_time} | Duration: {duration} min", file=sys.stderr)
                    else:
                        # Fallback without dateutil - try to calculate duration manually
                        local_date = start_dt[:10] if start_dt else ""
                        local_time = start_dt[11:16] if "T" in start_dt else "00:00"
                        
                        # Try to calculate duration from ISO strings
                        try:
                            from datetime import datetime as dt_module
                            start_dt_parsed = dt_module.fromisoformat(start_dt.replace('Z', '+00:00'))
                            end_dt_parsed = dt_module.fromisoformat(end_dt.replace('Z', '+00:00'))
                            duration = max(15, int((end_dt_parsed - start_dt_parsed).total_seconds() / 60))
                        except:
                            duration = 60
                else:
                    # All day event
                    local_date = start_dt[:10] if start_dt else ""
                    local_time = "00:00"
                    duration = 1440  # All day = 24h
            except Exception as parse_err:
                print(f"Date parsing error for {ev.get('summary')}: {parse_err}", file=sys.stderr)
                local_date = start_dt[:10] if start_dt else ""
                local_time = start_dt[11:16] if "T" in start_dt else "00:00"
                duration = 60
            
            events.append({
                "id": ev.get("id"),
                "title": ev.get("summary", "(Sans titre)"),
                "description": ev.get("description", ""),
                "date": local_date,
                "startTime": local_time,
                "duration": duration,
                "allDay": all_day,
                "location": ev.get("location", ""),
                "meetLink": ev.get("hangoutLink", ""),
                "source": "google",
                "googleEventId": ev.get("id"),
                "originalTimezone": start.get("timeZone", "Europe/Zurich"),
                "originalDateTime": start_dt
            })
        
        # Update cache
        gcal_events_cache["events"] = events
        gcal_events_cache["timestamp"] = time.time()
        
        return jsonify({"events": events, "cached": False})
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/gcal/events', methods=['POST'])
def gcal_create_event():
    """Create a new event in Google Calendar"""
    global gcal_events_cache
    gcal_events_cache["timestamp"] = 0  # Invalidate cache
    
    if not oauth_tokens:
        return jsonify({"error": "Not connected to Google"}), 401
    
    try:
        email = list(oauth_tokens.keys())[0]
        tokens = oauth_tokens[email]
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Content-Type": "application/json"
        }
        
        data = request.json
        calendar_id = data.get('calendar_id', 'primary')
        
        # Build event object for Google Calendar
        event = {
            "summary": data.get("title", "Événement"),
            "description": data.get("description", ""),
            "location": data.get("location", ""),
        }
        
        # Handle date/time
        event_date = data.get("date")
        start_time = data.get("startTime", "09:00")
        duration = data.get("duration", 60)
        timezone = data.get("timezone", "Europe/Zurich")
        
        if data.get("allDay"):
            event["start"] = {"date": event_date}
            event["end"] = {"date": event_date}
        else:
            start_datetime = f"{event_date}T{start_time}:00"
            # Calculate end time
            start_dt = datetime.strptime(f"{event_date} {start_time}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=duration)
            end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:00")
            
            event["start"] = {"dateTime": start_datetime, "timeZone": timezone}
            event["end"] = {"dateTime": end_datetime, "timeZone": timezone}
        
        # Add Google Meet if requested
        if data.get("addMeet"):
            event["conferenceData"] = {
                "createRequest": {
                    "requestId": f"meet-{datetime.now().timestamp()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"}
                }
            }
        
        # Create the event
        url = f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events"
        if data.get("addMeet"):
            url += "?conferenceDataVersion=1"
        
        response = requests.post(url, headers=headers, json=event)
        
        if response.status_code in [200, 201]:
            created = response.json()
            return jsonify({
                "success": True,
                "event": {
                    "id": created.get("id"),
                    "googleEventId": created.get("id"),
                    "title": created.get("summary"),
                    "meetLink": created.get("hangoutLink", ""),
                    "htmlLink": created.get("htmlLink")
                }
            })
        else:
            return jsonify({"error": response.text}), response.status_code
            
    except Exception as e:
        print(f"Error creating calendar event: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/gcal/events/<event_id>', methods=['PUT'])
def gcal_update_event(event_id):
    """Update an existing event in Google Calendar"""
    global gcal_events_cache
    gcal_events_cache["timestamp"] = 0  # Invalidate cache
    
    if not oauth_tokens:
        return jsonify({"error": "Not connected to Google"}), 401
    
    try:
        email = list(oauth_tokens.keys())[0]
        tokens = oauth_tokens[email]
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "Content-Type": "application/json"
        }
        
        data = request.json
        calendar_id = data.get('calendar_id', 'primary')
        
        # Build event object
        event = {
            "summary": data.get("title"),
            "description": data.get("description", ""),
            "location": data.get("location", ""),
        }
        
        event_date = data.get("date")
        start_time = data.get("startTime", "09:00")
        duration = data.get("duration", 60)
        timezone = data.get("timezone", "Europe/Zurich")
        
        if data.get("allDay"):
            event["start"] = {"date": event_date}
            event["end"] = {"date": event_date}
        else:
            start_datetime = f"{event_date}T{start_time}:00"
            start_dt = datetime.strptime(f"{event_date} {start_time}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=duration)
            end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:00")
            
            event["start"] = {"dateTime": start_datetime, "timeZone": timezone}
            event["end"] = {"dateTime": end_datetime, "timeZone": timezone}
        
        response = requests.put(
            f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events/{event_id}",
            headers=headers,
            json=event
        )
        
        if response.status_code == 200:
            return jsonify({"success": True, "event": response.json()})
        else:
            return jsonify({"error": response.text}), response.status_code
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/gcal/events/<event_id>', methods=['DELETE'])
def gcal_delete_event(event_id):
    """Delete an event from Google Calendar"""
    global gcal_events_cache
    gcal_events_cache["timestamp"] = 0  # Invalidate cache
    
    if not oauth_tokens:
        return jsonify({"error": "Not connected to Google"}), 401
    
    try:
        email = list(oauth_tokens.keys())[0]
        tokens = oauth_tokens[email]
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        
        calendar_id = request.args.get('calendar_id', 'primary')
        
        response = requests.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events/{event_id}",
            headers=headers
        )
        
        if response.status_code in [200, 204]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": response.text}), response.status_code
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/gcal/sync-status')
def gcal_sync_status():
    """Check if Google Calendar is connected and return sync info"""
    if not oauth_tokens:
        return jsonify({"connected": False})
    
    try:
        email = list(oauth_tokens.keys())[0]
        
        # Get valid token (with auto-refresh)
        access_token = get_valid_google_token(email)
        if not access_token:
            return jsonify({"connected": False, "error": "Token refresh failed"})
        
        # Verify token is still valid by fetching calendar list
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify({
                "connected": True,
                "email": email,
                "lastSync": datetime.now().isoformat()
            })
        elif response.status_code == 401:
            # Token definitely invalid, try one more refresh
            if refresh_google_token(email):
                return jsonify({
                    "connected": True,
                    "email": email,
                    "lastSync": datetime.now().isoformat(),
                    "refreshed": True
                })
            return jsonify({"connected": False, "error": "Token expired"})
        else:
            # Other error (network, rate limit) - don't mark as disconnected
            return jsonify({
                "connected": True,  # Assume still connected on transient errors
                "email": email,
                "warning": f"Status check failed: {response.status_code}"
            })
    except requests.exceptions.Timeout:
        # Timeout - assume still connected
        email = list(oauth_tokens.keys())[0] if oauth_tokens else None
        return jsonify({
            "connected": True if oauth_tokens else False,
            "email": email,
            "warning": "Connection check timed out"
        })
    except Exception as e:
        # Network error - assume still connected if we have tokens
        email = list(oauth_tokens.keys())[0] if oauth_tokens else None
        return jsonify({
            "connected": True if oauth_tokens else False,
            "email": email,
            "warning": str(e)
        })


# --- Version & Updates ---
APP_VERSION = "2.4.2"
GITHUB_REPO_API = "https://api.github.com/repos/VilaJo/Marion-Web-OS-v2"

@app.route('/api/version')
def get_version():
    """Get current app version"""
    return jsonify({
        "version": APP_VERSION,
        "name": "Marion Web OS",
        "buildDate": datetime.now().strftime("%Y-%m-%d")
    })

@app.route('/api/updates/check')
def check_updates():
    """Check GitHub for new releases"""
    try:
        # Get latest release from GitHub
        response = requests.get(
            f"{GITHUB_REPO_API}/releases/latest",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            latest_version = data.get("tag_name", "").lstrip("v")
            
            # Compare versions
            def version_tuple(v):
                return tuple(map(int, v.split(".")))
            
            try:
                is_newer = version_tuple(latest_version) > version_tuple(APP_VERSION)
            except:
                is_newer = latest_version != APP_VERSION
            
            return jsonify({
                "currentVersion": APP_VERSION,
                "latestVersion": latest_version,
                "updateAvailable": is_newer,
                "releaseNotes": data.get("body", ""),
                "releaseName": data.get("name", ""),
                "publishedAt": data.get("published_at", ""),
                "downloadUrl": data.get("zipball_url", ""),
                "htmlUrl": data.get("html_url", "")
            })
        elif response.status_code == 404:
            # No releases yet, check if there are commits
            commits_response = requests.get(
                f"{GITHUB_REPO_API}/commits?per_page=1",
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=10
            )
            if commits_response.status_code == 200:
                commits = commits_response.json()
                if commits:
                    return jsonify({
                        "currentVersion": APP_VERSION,
                        "latestVersion": APP_VERSION,
                        "updateAvailable": False,
                        "message": "Vous utilisez la dernière version.",
                        "lastCommit": commits[0].get("sha", "")[:7] if commits else None
                    })
            return jsonify({
                "currentVersion": APP_VERSION,
                "latestVersion": APP_VERSION,
                "updateAvailable": False,
                "message": "Aucune release trouvée sur GitHub."
            })
        else:
            return jsonify({
                "error": f"GitHub API error: {response.status_code}",
                "currentVersion": APP_VERSION
            }), 500
            
    except requests.exceptions.Timeout:
        return jsonify({
            "error": "Timeout lors de la vérification",
            "currentVersion": APP_VERSION
        }), 504
    except Exception as e:
        return jsonify({
            "error": str(e),
            "currentVersion": APP_VERSION
        }), 500

@app.route('/api/updates/apply', methods=['POST'])
def apply_update():
    """Trigger the update script"""
    import subprocess
    
    try:
        # Path to the update script
        app_dir = Path(__file__).parent
        update_script = app_dir / "METTRE_A_JOUR.command"
        
        if not update_script.exists():
            return jsonify({"error": "Script de mise à jour introuvable"}), 404
        
        # Make sure it's executable
        os.chmod(update_script, 0o755)
        
        # Get the download URL from the request
        data = request.json or {}
        download_url = data.get('downloadUrl', 'https://github.com/VilaJo/Marion-Web-OS-v2/archive/refs/heads/main.zip')
        
        # Create a response that tells the client to expect a restart
        # The actual update will be run in background
        def run_update():
            import time
            time.sleep(2)  # Give time for response to be sent
            try:
                # Run the update script
                subprocess.Popen(
                    ['open', str(update_script)],
                    cwd=str(app_dir),
                    start_new_session=True
                )
            except Exception as e:
                print(f"Update error: {e}", file=sys.stderr)
        
        import threading
        update_thread = threading.Thread(target=run_update, daemon=True)
        update_thread.start()
        
        return jsonify({
            "success": True,
            "message": "Mise à jour en cours... L'application va redémarrer.",
            "instruction": "Le script de mise à jour va s'ouvrir. Suivez les instructions dans le terminal."
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/updates/changelog')
def get_changelog():
    """Get the changelog file"""
    try:
        changelog_path = Path(__file__).parent / "CHANGELOG.md"
        if changelog_path.exists():
            with open(changelog_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return jsonify({"changelog": content})
        else:
            return jsonify({"changelog": "Aucun changelog disponible."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Serve Frontend ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Ne pas servir les fichiers statiques pour les routes API
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    try:
        print("Initializing Gemini Client...", file=sys.stderr)
        init_client()
        print(f"Client Status: {{'Configured' if client else 'Not Configured'}}", file=sys.stderr)
        print("Starting Franck Server on port 5003...", file=sys.stderr)
        app.run(host='0.0.0.0', port=5003, debug=False, use_reloader=False)
    except Exception as e:
        print(f"CRITICAL STARTUP ERROR: {e}", file=sys.stderr)
