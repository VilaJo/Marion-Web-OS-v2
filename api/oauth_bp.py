"""
OAuth Blueprint - Google OAuth, Drive and Google Calendar routes.
Handles: OAuth login/callback/status/disconnect, Drive list/upload/sync,
         Google Calendar CRUD, sync-status.
"""

import sys
import time
import json
import base64
import binascii
import uuid
from services.logger import get_logger

logger = get_logger('api.oauth')
import urllib.parse
import requests
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify

from config import get_current_config
from services.oauth_service import (
    oauth_tokens, load_from_db, persist_to_db, store_tokens,
    refresh_google_token, get_valid_token, get_first_email,
    disconnect as oauth_disconnect,
)
from api.shared import DESKTOP_PATH, get_safe_path, OAUTH_TOKENS_ENC, OAUTH_TOKENS_JSON, error_response

try:
    import caldav
except Exception:  # pragma: no cover - optional dependency at runtime
    caldav = None

# Optional: dateutil for better date parsing
try:
    from dateutil import parser as date_parser
except ImportError:
    date_parser = None

cfg = get_current_config()

oauth_bp = Blueprint('oauth', __name__, url_prefix='/api/v1')


# ============================================================================
# Google OAuth Flow
# ============================================================================

@oauth_bp.route('/oauth/google/login')
def google_oauth_login():
    """Initiate Google OAuth flow."""
    if not cfg.GOOGLE_CLIENT_ID or not cfg.GOOGLE_CLIENT_SECRET:
        return jsonify({
            "error": "Google OAuth non configuré sur ce Mac. "
                     "Ajoute GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans "
                     "~/Bibliothèque/Application Support/Marion Web OS/MARION-env.local "
                     "puis relance Marion.",
        }), 503

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={cfg.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={urllib.parse.quote(cfg.GOOGLE_REDIRECT_URI)}&"
        "response_type=code&"
        f"scope={urllib.parse.quote(cfg.GOOGLE_SCOPES)}&"
        "access_type=offline&"
        "prompt=consent"
    )
    return jsonify({"auth_url": auth_url})


@oauth_bp.route('/oauth/google/callback')
def google_oauth_callback():
    """Handle Google OAuth callback."""
    code = request.args.get('code')
    error = request.args.get('error')

    if error:
        return _oauth_html_response('GOOGLE_AUTH_ERROR', error=error)

    if not code:
        return "No authorization code received", 400

    token_data = {
        "code": code,
        "client_id": cfg.GOOGLE_CLIENT_ID,
        "client_secret": cfg.GOOGLE_CLIENT_SECRET,
        "redirect_uri": cfg.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        response = requests.post("https://oauth2.googleapis.com/token", data=token_data)
        tokens = response.json()

        if "error" in tokens:
            return _oauth_html_response(
                'GOOGLE_AUTH_ERROR',
                error=tokens.get("error_description", tokens["error"]),
            )

        # Get user info
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        user_info = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo", headers=headers
        ).json()

        user_email = user_info.get("email", "default")
        store_tokens(user_email, tokens, user_info)

        return _oauth_html_response(
            'GOOGLE_AUTH_SUCCESS',
            email=user_email,
            name=user_info.get("name", ""),
        )
    except Exception as e:
        return _oauth_html_response('GOOGLE_AUTH_ERROR', error=str(e))


@oauth_bp.route('/oauth/google/status')
def google_oauth_status():
    """Check if user is connected to Google. Proactively refreshes token if needed."""
    if not oauth_tokens:
        load_from_db()
    if not oauth_tokens:
        return jsonify({"connected": False})

    first_email = list(oauth_tokens.keys())[0]
    first_user = oauth_tokens[first_email]

    # Attempt proactive refresh so the token is always fresh
    token = get_valid_token(first_email)

    if token:
        return jsonify({
            "connected": True,
            "email": first_user.get("user_info", {}).get("email", first_email),
            "name": first_user.get("user_info", {}).get("name", ""),
        })

    # Token refresh failed — there are stored credentials but they're unusable
    has_refresh = bool(first_user.get("refresh_token"))
    return jsonify({
        "connected": False,
        "needsReconnect": not has_refresh,
        "email": first_user.get("user_info", {}).get("email", first_email),
    })


@oauth_bp.route('/oauth/google/disconnect', methods=['POST'])
def google_oauth_disconnect():
    """Disconnect from Google."""
    oauth_disconnect()
    # Clean up legacy files
    for legacy_file in [OAUTH_TOKENS_JSON, OAUTH_TOKENS_ENC]:
        if legacy_file.exists():
            try:
                legacy_file.unlink()
            except Exception:
                pass
    return jsonify({"success": True})


# ============================================================================
# Google Drive
# ============================================================================

@oauth_bp.route('/drive/list')
def google_drive_list():
    """List files in Google Drive."""
    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected"}), 401

    access_token = get_valid_token(email)
    if not access_token:
        return jsonify({"error": "Token expired"}), 401

    folder = request.args.get('folder', '')
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        query = "trashed=false"
        if folder:
            query += f" and '{folder}' in parents"
        response = requests.get(
            f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(query)}"
            "&fields=files(id,name,mimeType,modifiedTime,size)",
            headers=headers,
        )
        return jsonify(response.json())
    except Exception as e:
        return error_response(e)


@oauth_bp.route('/drive/upload', methods=['POST'])
def google_drive_upload():
    """Upload a file to Google Drive."""
    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected"}), 401

    access_token = get_valid_token(email)
    if not access_token:
        return jsonify({"error": "Token expired"}), 401

    data = request.json
    file_path = data.get('file_path')
    folder_id = data.get('folder_id')

    if not file_path:
        return jsonify({"error": "No file path provided"}), 400

    try:
        local_path = get_safe_path(file_path)
        if not local_path.exists():
            return jsonify({"error": "File not found"}), 404

        file_metadata = {"name": local_path.name}
        if folder_id:
            file_metadata["parents"] = [folder_id]

        headers = {"Authorization": f"Bearer {access_token}"}
        with open(local_path, 'rb') as f:
            files = {
                'metadata': ('metadata', json.dumps(file_metadata), 'application/json'),
                'file': (local_path.name, f),
            }
            response = requests.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                headers=headers,
                files=files,
            )
        return jsonify(response.json())
    except Exception as e:
        return error_response(e)


@oauth_bp.route('/drive/sync', methods=['POST'])
def google_drive_sync():
    """Sync a client folder to Google Drive."""
    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected"}), 401

    access_token = get_valid_token(email)
    if not access_token:
        return jsonify({"error": "Token expired"}), 401

    data = request.json
    client_folder = data.get('client_folder')
    drive_folder_name = data.get('drive_folder_name', '')

    if not client_folder:
        return jsonify({"error": "No client folder specified"}), 400

    try:
        local_path = get_safe_path(client_folder)
        if not local_path.exists():
            return jsonify({"error": "Folder not found"}), 404

        synced_files = []
        headers = {"Authorization": f"Bearer {access_token}"}
        parent_folder_id = None

        # Find or create parent folder
        if drive_folder_name:
            parent_query = (
                f"name='{drive_folder_name}' and mimeType='application/vnd.google-apps.folder' "
                "and trashed=false and 'root' in parents"
            )
            parent_response = requests.get(
                f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(parent_query)}",
                headers=headers,
            ).json()

            if parent_response.get('files'):
                parent_folder_id = parent_response['files'][0]['id']
            else:
                parent_metadata = {
                    "name": drive_folder_name,
                    "mimeType": "application/vnd.google-apps.folder",
                }
                parent_create = requests.post(
                    "https://www.googleapis.com/drive/v3/files",
                    headers={**headers, "Content-Type": "application/json"},
                    json=parent_metadata,
                ).json()
                parent_folder_id = parent_create.get('id')

        # Find or create client folder in Drive
        folder_query = (
            f"name='{local_path.name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        if parent_folder_id:
            folder_query += f" and '{parent_folder_id}' in parents"

        folder_response = requests.get(
            f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(folder_query)}",
            headers=headers,
        ).json()

        if folder_response.get('files'):
            client_drive_folder_id = folder_response['files'][0]['id']
        else:
            folder_metadata = {
                "name": local_path.name,
                "mimeType": "application/vnd.google-apps.folder",
            }
            if parent_folder_id:
                folder_metadata["parents"] = [parent_folder_id]
            create_response = requests.post(
                "https://www.googleapis.com/drive/v3/files",
                headers={**headers, "Content-Type": "application/json"},
                json=folder_metadata,
            ).json()
            client_drive_folder_id = create_response.get('id')

        # Sync files
        for item in local_path.iterdir():
            if item.is_file() and not item.name.startswith('.'):
                with open(item, 'rb') as f:
                    file_meta = {"name": item.name, "parents": [client_drive_folder_id]}
                    files = {
                        'metadata': ('metadata', json.dumps(file_meta), 'application/json'),
                        'file': (item.name, f),
                    }
                    resp = requests.post(
                        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                        headers=headers,
                        files=files,
                    )
                    if resp.status_code == 200:
                        synced_files.append(item.name)

        return jsonify({
            "success": True,
            "folder_id": client_drive_folder_id,
            "synced_files": synced_files,
        })
    except Exception as e:
        return error_response(e)


# ============================================================================
# Google Calendar
# ============================================================================

# Server-side cache for Google Calendar events
_gcal_cache = {"events": [], "timestamp": 0, "ttl": 60}

def invalidate_gcal_cache():
    """Invalidate the GCal cache so the next fetch hits Google directly."""
    _gcal_cache["timestamp"] = 0


@oauth_bp.route('/gcal/calendars')
def gcal_list_calendars():
    """List all Google Calendars for the user."""
    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected to Google"}), 401

    try:
        access_token = get_valid_token(email)
        if not access_token:
            return jsonify({"error": "Token expired, please reconnect"}), 401

        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            headers=headers,
        )
        if response.status_code == 401:
            return jsonify({"error": "Token expired, please reconnect"}), 401

        data = response.json()
        calendars = [{
            "id": cal.get("id"),
            "name": cal.get("summary"),
            "primary": cal.get("primary", False),
            "color": cal.get("backgroundColor"),
        } for cal in data.get("items", [])]
        return jsonify({"calendars": calendars})
    except Exception as e:
        return error_response(e)


@oauth_bp.route('/gcal/events')
def gcal_list_events():
    """List events from Google Calendar (with caching)."""
    global _gcal_cache

    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected to Google"}), 401

    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_age = time.time() - _gcal_cache["timestamp"]

    if not force_refresh and cache_age < _gcal_cache["ttl"] and _gcal_cache["events"]:
        return jsonify({"events": _gcal_cache["events"], "cached": True})

    try:
        access_token = get_valid_token(email)
        if not access_token:
            return jsonify({"error": "Token refresh failed"}), 401

        headers = {"Authorization": f"Bearer {access_token}"}
        calendar_id = request.args.get('calendar_id', 'primary')
        # Default: from start of current month to +90 days
        now = datetime.utcnow()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        time_min = request.args.get('time_min', start_of_month.isoformat() + 'Z')
        time_max = request.args.get(
            'time_max', (now + timedelta(days=90)).isoformat() + 'Z'
        )

        response = requests.get(
            f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events",
            headers=headers,
            params={
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": True,
                "orderBy": "startTime",
                "maxResults": 100,
            },
        )

        if response.status_code == 401:
            if refresh_google_token(email):
                access_token = oauth_tokens[email].get('access_token')
                headers = {"Authorization": f"Bearer {access_token}"}
                response = requests.get(
                    f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(calendar_id)}/events",
                    headers=headers,
                    params={
                        "timeMin": time_min, "timeMax": time_max,
                        "singleEvents": True, "orderBy": "startTime", "maxResults": 100,
                    },
                    timeout=15,
                )
                if response.status_code != 200:
                    return jsonify({"error": "Token refresh failed"}), 401
            else:
                return jsonify({"error": "Token expired, please reconnect"}), 401

        data = response.json()
        events = _parse_gcal_events(data.get("items", []))

        _gcal_cache["events"] = events
        _gcal_cache["timestamp"] = time.time()
        return jsonify({"events": events, "cached": False})
    except Exception as e:
        logger.error("Error fetching calendar events: %s", e, exc_info=True)
        return error_response(e)


@oauth_bp.route('/gcal/events', methods=['POST'])
def gcal_create_event():
    """Create a new event in Google Calendar."""
    _gcal_cache["timestamp"] = 0  # Invalidate cache

    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected to Google"}), 401

    try:
        access_token = get_valid_token(email)
        if not access_token:
            return jsonify({"error": "Token expired"}), 401

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        data = request.json
        calendar_id = data.get('calendar_id', 'primary')

        event = {
            "summary": data.get("title", "Evenement"),
            "description": data.get("description", ""),
            "location": data.get("location", ""),
        }

        color_id = data.get("colorId")
        if color_id:
            event["colorId"] = str(color_id)

        event_date = data.get("date")
        start_time_str = data.get("startTime", "09:00")
        duration = data.get("duration", 60)
        timezone = data.get("timezone", "Europe/Zurich")

        if data.get("allDay"):
            event["start"] = {"date": event_date}
            event["end"] = {"date": event_date}
        else:
            start_datetime = f"{event_date}T{start_time_str}:00"
            start_dt = datetime.strptime(f"{event_date} {start_time_str}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=duration)
            end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:00")
            event["start"] = {"dateTime": start_datetime, "timeZone": timezone}
            event["end"] = {"dateTime": end_datetime, "timeZone": timezone}

        if data.get("addMeet"):
            event["conferenceData"] = {
                "createRequest": {
                    "requestId": f"meet-{datetime.now().timestamp()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }

        url = (
            f"https://www.googleapis.com/calendar/v3/calendars/"
            f"{urllib.parse.quote(calendar_id)}/events"
        )
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
                    "htmlLink": created.get("htmlLink"),
                },
            })
        return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        logger.error("Error creating calendar event: %s", e, exc_info=True)
        return error_response(e)


@oauth_bp.route('/gcal/events/<event_id>', methods=['PUT'])
def gcal_update_event(event_id):
    """Update an existing event in Google Calendar."""
    _gcal_cache["timestamp"] = 0

    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected to Google"}), 401

    try:
        access_token = get_valid_token(email)
        if not access_token:
            return jsonify({"error": "Token expired"}), 401

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        data = request.json
        calendar_id = data.get('calendar_id', 'primary')
        timezone = data.get("timezone", "Europe/Zurich")

        event = {
            "summary": data.get("title"),
            "description": data.get("description", ""),
            "location": data.get("location", ""),
        }

        color_id = data.get("colorId")
        if color_id:
            event["colorId"] = str(color_id)

        event_date = data.get("date")
        start_time_str = data.get("startTime", "09:00")
        duration = data.get("duration", 60)

        if data.get("allDay"):
            event["start"] = {"date": event_date}
            event["end"] = {"date": event_date}
        else:
            start_datetime = f"{event_date}T{start_time_str}:00"
            start_dt = datetime.strptime(f"{event_date} {start_time_str}", "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=duration)
            end_datetime = end_dt.strftime("%Y-%m-%dT%H:%M:00")
            event["start"] = {"dateTime": start_datetime, "timeZone": timezone}
            event["end"] = {"dateTime": end_datetime, "timeZone": timezone}

        response = requests.put(
            f"https://www.googleapis.com/calendar/v3/calendars/"
            f"{urllib.parse.quote(calendar_id)}/events/{event_id}",
            headers=headers,
            json=event,
        )

        if response.status_code == 200:
            return jsonify({"success": True, "event": response.json()})
        return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return error_response(e)


@oauth_bp.route('/gcal/events/<event_id>', methods=['DELETE'])
def gcal_delete_event(event_id):
    """Delete an event from Google Calendar."""
    _gcal_cache["timestamp"] = 0

    email = get_first_email()
    if not email:
        return jsonify({"error": "Not connected to Google"}), 401

    try:
        access_token = get_valid_token(email)
        if not access_token:
            return jsonify({"error": "Token expired"}), 401

        headers = {"Authorization": f"Bearer {access_token}"}
        calendar_id = request.args.get('calendar_id', 'primary')

        response = requests.delete(
            f"https://www.googleapis.com/calendar/v3/calendars/"
            f"{urllib.parse.quote(calendar_id)}/events/{event_id}",
            headers=headers,
        )

        if response.status_code in [200, 204]:
            return jsonify({"success": True})
        return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return error_response(e)


@oauth_bp.route('/gcal/sync-status')
def gcal_sync_status():
    """Check if Google Calendar is connected.

    Verifies by making a lightweight tokeninfo call to Google so that
    stale / expired tokens are correctly detected even when expires_at
    is unknown (e.g. right after server restart from persisted DB tokens).
    """
    email = get_first_email()
    if not email:
        return jsonify({"connected": False})

    access_token = get_valid_token(email)
    if not access_token:
        return jsonify({
            "connected": False,
            "email": email,
            "needsReconnect": True,
            "error": "Token expired or unavailable",
        })

    # Quick token validation: Google's tokeninfo endpoint is free & fast
    try:
        check = requests.get(
            "https://www.googleapis.com/oauth2/v3/tokeninfo",
            params={"access_token": access_token},
            timeout=5,
        )
        if check.status_code == 200:
            return jsonify({
                "connected": True,
                "email": email,
                "lastSync": datetime.now().isoformat(),
            })

        # 400 from tokeninfo means the token is invalid/expired
        # Try one more proactive refresh before giving up
        if refresh_google_token(email):
            return jsonify({
                "connected": True,
                "email": email,
                "lastSync": datetime.now().isoformat(),
            })

        return jsonify({
            "connected": False,
            "email": email,
            "needsReconnect": True,
            "error": "Token expired — please reconnect Google Calendar",
        })
    except Exception:
        # Network error — assume connected to avoid false "reconnect" loops
        return jsonify({
            "connected": True,
            "email": email,
            "lastSync": datetime.now().isoformat(),
        })


# ============================================================================
# Infomaniak Calendar (CalDAV)
# ============================================================================

def _decode_infomaniak_event_id(encoded_id: str) -> str:
    padded = encoded_id + ("=" * (-len(encoded_id) % 4))
    return base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")


def _encode_infomaniak_event_id(raw_id: str) -> str:
    return base64.urlsafe_b64encode(raw_id.encode("utf-8")).decode("utf-8").rstrip("=")


def _parse_ical_datetime(value):
    if value is None:
        return None
    dt = value.dt if hasattr(value, "dt") else value
    if isinstance(dt, datetime):
        return dt
    if hasattr(dt, "year") and hasattr(dt, "month") and hasattr(dt, "day"):
        return datetime(dt.year, dt.month, dt.day)
    return None


def _resolve_infomaniak_credentials():
    user = (request.headers.get("X-Infomaniak-Username") or "").strip()
    pwd = (request.headers.get("X-Infomaniak-Password") or "").strip()
    if user and pwd:
        return user, pwd

    try:
        from api.email_bp import _get_token, _decrypt_creds

        token = _get_token()
        username, password = _decrypt_creds(token)
        if username and password:
            return username, password
    except Exception as e:
        logger.debug("Infomaniak creds fallback failed: %s", e)

    return None, None


def _get_infomaniak_calendar():
    if caldav is None:
        raise RuntimeError("CalDAV dependency missing")

    username, password = _resolve_infomaniak_credentials()
    if not username or not password:
        return None, None, None

    server_url = getattr(cfg, "INFOMANIAK_CALDAV_URL", None) or "https://sync.infomaniak.com/"
    candidate_usernames = [username]
    if "@" in username:
        candidate_usernames.append(username.split("@", 1)[0])

    client = None
    calendars = None
    for candidate in candidate_usernames:
        try:
            trial_client = caldav.DAVClient(url=server_url, username=candidate, password=password)
            principal = trial_client.principal()
            trial_calendars = principal.calendars()
            client = trial_client
            username = candidate
            calendars = trial_calendars
            break
        except Exception:
            continue

    if client is None or calendars is None:
        raise RuntimeError("Infomaniak CalDAV authentication failed")
    if not calendars:
        return client, username, None
    preferred = getattr(cfg, "INFOMANIAK_CALENDAR_NAME", "").strip().lower()
    if preferred:
        for cal in calendars:
            if (getattr(cal, "name", "") or "").strip().lower() == preferred:
                return client, username, cal
    return client, username, calendars[0]


def _parse_infomaniak_event(ev):
    vobj = getattr(ev, "vobject_instance", None)
    if not vobj or not hasattr(vobj, "vevent"):
        return None
    vevent = vobj.vevent
    start_dt = _parse_ical_datetime(getattr(vevent, "dtstart", None))
    if not start_dt:
        return None
    end_dt = _parse_ical_datetime(getattr(vevent, "dtend", None))
    if not end_dt and hasattr(vevent, "duration"):
        try:
            end_dt = start_dt + vevent.duration.value
        except Exception:
            end_dt = None

    if end_dt:
        duration = max(15, int((end_dt - start_dt).total_seconds() / 60))
    else:
        duration = 60

    summary = getattr(getattr(vevent, "summary", None), "value", "(Sans titre)")
    description = getattr(getattr(vevent, "description", None), "value", "")
    location = getattr(getattr(vevent, "location", None), "value", "")

    return {
        "id": _encode_infomaniak_event_id(ev.url),
        "infomaniakEventId": _encode_infomaniak_event_id(ev.url),
        "title": summary,
        "description": description,
        "location": location,
        "date": start_dt.strftime("%Y-%m-%d"),
        "startTime": start_dt.strftime("%H:%M"),
        "duration": duration,
        "source": "infomaniak",
        "originalTimezone": "Europe/Zurich",
        "originalDateTime": start_dt.isoformat(),
    }


@oauth_bp.route('/ical/sync-status')
def infomaniak_sync_status():
    if caldav is None:
        return jsonify({"connected": False, "error": "CalDAV dependency missing"}), 503
    try:
        client, username, calendar = _get_infomaniak_calendar()
        if not client or not username:
            return jsonify({"connected": False, "error": "Infomaniak email credentials not connected"}), 200
        if calendar is None:
            return jsonify({"connected": False, "username": username, "error": "No calendar found"}), 200
        return jsonify({"connected": True, "username": username, "calendarName": getattr(calendar, "name", "Infomaniak Calendar")})
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)}), 200


@oauth_bp.route('/ical/events')
def infomaniak_list_events():
    if caldav is None:
        return jsonify({"events": [], "error": "CalDAV dependency missing"}), 503
    try:
        client, username, calendar = _get_infomaniak_calendar()
        if not client or not username or calendar is None:
            return jsonify({"events": []})

        now = datetime.utcnow()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        time_min = request.args.get('time_min', start_of_month.isoformat())
        time_max = request.args.get('time_max', (now + timedelta(days=90)).isoformat())

        try:
            dt_start = datetime.fromisoformat(time_min.replace("Z", "+00:00"))
        except Exception:
            dt_start = start_of_month
        try:
            dt_end = datetime.fromisoformat(time_max.replace("Z", "+00:00"))
        except Exception:
            dt_end = now + timedelta(days=90)

        raw_events = calendar.date_search(start=dt_start, end=dt_end)
        parsed = []
        for ev in raw_events:
            item = _parse_infomaniak_event(ev)
            if item is not None:
                parsed.append(item)
        return jsonify({"events": parsed})
    except Exception as e:
        logger.error("Error fetching Infomaniak calendar events: %s", e, exc_info=True)
        return error_response(e)


@oauth_bp.route('/ical/events', methods=['POST'])
def infomaniak_create_event():
    if caldav is None:
        return jsonify({"error": "CalDAV dependency missing"}), 503
    try:
        client, username, calendar = _get_infomaniak_calendar()
        if not client or not username or calendar is None:
            return jsonify({"error": "Infomaniak not connected"}), 401

        data = request.json or {}
        title = data.get("title", "Evenement")
        description = data.get("description", "")
        location = data.get("location", "")
        event_date = data.get("date")
        start_time = data.get("startTime", "09:00")
        duration = int(data.get("duration", 60))

        if not event_date:
            return jsonify({"error": "Missing date"}), 400

        start_dt = datetime.strptime(f"{event_date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=max(15, duration))
        uid = f"marion-{uuid.uuid4()}@infomaniak-sync"
        ics = (
            "BEGIN:VCALENDAR\r\n"
            "VERSION:2.0\r\n"
            "PRODID:-//Marion Web OS//FR\r\n"
            "BEGIN:VEVENT\r\n"
            f"UID:{uid}\r\n"
            f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}\r\n"
            f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%S')}\r\n"
            f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%S')}\r\n"
            f"SUMMARY:{title}\r\n"
            f"DESCRIPTION:{description}\r\n"
            f"LOCATION:{location}\r\n"
            "END:VEVENT\r\n"
            "END:VCALENDAR\r\n"
        )
        ev = calendar.save_event(ics)
        event_id = _encode_infomaniak_event_id(ev.url)
        return jsonify({"success": True, "event": {"id": event_id, "infomaniakEventId": event_id}})
    except Exception as e:
        logger.error("Error creating Infomaniak calendar event: %s", e, exc_info=True)
        return error_response(e)


@oauth_bp.route('/ical/events/<event_id>', methods=['PUT'])
def infomaniak_update_event(event_id):
    if caldav is None:
        return jsonify({"error": "CalDAV dependency missing"}), 503
    try:
        client, username, calendar = _get_infomaniak_calendar()
        if not client or not username or calendar is None:
            return jsonify({"error": "Infomaniak not connected"}), 401

        try:
            raw_url = _decode_infomaniak_event_id(event_id)
        except (ValueError, binascii.Error):
            return jsonify({"error": "Invalid Infomaniak event id"}), 400
        ev = calendar.event(raw_url)
        vobj = ev.vobject_instance
        if not hasattr(vobj, "vevent"):
            return jsonify({"error": "Event payload invalid"}), 400

        data = request.json or {}
        title = data.get("title", "Evenement")
        description = data.get("description", "")
        location = data.get("location", "")
        event_date = data.get("date")
        start_time = data.get("startTime", "09:00")
        duration = int(data.get("duration", 60))
        if not event_date:
            return jsonify({"error": "Missing date"}), 400

        start_dt = datetime.strptime(f"{event_date} {start_time}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=max(15, duration))
        vobj.vevent.summary.value = title
        if hasattr(vobj.vevent, "description"):
            vobj.vevent.description.value = description
        else:
            vobj.vevent.add("description").value = description
        if hasattr(vobj.vevent, "location"):
            vobj.vevent.location.value = location
        else:
            vobj.vevent.add("location").value = location
        vobj.vevent.dtstart.value = start_dt
        vobj.vevent.dtend.value = end_dt
        ev.data = vobj.serialize()
        ev.save()
        return jsonify({"success": True})
    except Exception as e:
        logger.error("Error updating Infomaniak calendar event: %s", e, exc_info=True)
        return error_response(e)


@oauth_bp.route('/ical/events/<event_id>', methods=['DELETE'])
def infomaniak_delete_event(event_id):
    if caldav is None:
        return jsonify({"error": "CalDAV dependency missing"}), 503
    try:
        client, username, calendar = _get_infomaniak_calendar()
        if not client or not username or calendar is None:
            return jsonify({"error": "Infomaniak not connected"}), 401
        try:
            raw_url = _decode_infomaniak_event_id(event_id)
        except (ValueError, binascii.Error):
            return jsonify({"error": "Invalid Infomaniak event id"}), 400
        ev = calendar.event(raw_url)
        ev.delete()
        return jsonify({"success": True})
    except Exception as e:
        logger.error("Error deleting Infomaniak calendar event: %s", e, exc_info=True)
        return error_response(e)


# ============================================================================
# Helpers
# ============================================================================

def _oauth_html_response(msg_type: str, **kwargs):
    """Build the small HTML page that communicates back to the opener window."""
    payload = json.dumps({"type": msg_type, **kwargs})
    summary = kwargs.get('error') or kwargs.get('email') or ''
    return f"""
    <html><body>
    <script>
        window.opener.postMessage({payload}, '*');
        window.close();
    </script>
    <p>{summary}</p>
    </body></html>
    """


def _parse_gcal_events(items: list) -> list:
    """Parse raw Google Calendar event items into our normalised format."""
    events = []
    for ev in items:
        start = ev.get("start", {})
        end = ev.get("end", {})

        if "dateTime" in start:
            start_dt_str = start["dateTime"]
            end_dt_str = end.get("dateTime", start_dt_str)
            all_day = False
        else:
            start_dt_str = start.get("date", "")
            end_dt_str = end.get("date", start_dt_str)
            all_day = True

        local_date = ""
        local_time = "00:00"
        duration = 60

        try:
            if not all_day:
                if date_parser:
                    from zoneinfo import ZoneInfo
                    local_tz = ZoneInfo("Europe/Zurich")
                    start_parsed = date_parser.parse(start_dt_str)
                    end_parsed = date_parser.parse(end_dt_str)
                    duration_seconds = (end_parsed - start_parsed).total_seconds()
                    duration = max(15, int(duration_seconds / 60))
                    if start_parsed.tzinfo is not None:
                        start_local = start_parsed.astimezone(local_tz)
                    else:
                        start_local = start_parsed.replace(
                            tzinfo=ZoneInfo("UTC")
                        ).astimezone(local_tz)
                    local_date = start_local.strftime("%Y-%m-%d")
                    local_time = start_local.strftime("%H:%M")
                else:
                    local_date = start_dt_str[:10] if start_dt_str else ""
                    local_time = start_dt_str[11:16] if "T" in start_dt_str else "00:00"
                    try:
                        s = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
                        e = datetime.fromisoformat(end_dt_str.replace('Z', '+00:00'))
                        duration = max(15, int((e - s).total_seconds() / 60))
                    except Exception:
                        duration = 60
            else:
                local_date = start_dt_str[:10] if start_dt_str else ""
                local_time = "00:00"
                duration = 1440
        except Exception as parse_err:
            logger.warning("Date parsing error for %s: %s", ev.get('summary'), parse_err)
            local_date = start_dt_str[:10] if start_dt_str else ""
            local_time = start_dt_str[11:16] if "T" in start_dt_str else "00:00"
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
            "colorId": ev.get("colorId", ""),
            "originalTimezone": start.get("timeZone", "Europe/Zurich"),
            "originalDateTime": start_dt_str,
        })
    return events
