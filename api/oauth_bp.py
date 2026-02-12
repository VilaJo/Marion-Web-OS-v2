"""
OAuth Blueprint - Google OAuth, Drive and Google Calendar routes.
Handles: OAuth login/callback/status/disconnect, Drive list/upload/sync,
         Google Calendar CRUD, sync-status.
"""

import sys
import time
import json
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
        print(f"Error fetching calendar events: {e}", file=sys.stderr)
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
        print(f"Error creating calendar event: {e}", file=sys.stderr)
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
    """Check if Google Calendar is connected — uses proactive token refresh, no extra API call."""
    email = get_first_email()
    if not email:
        return jsonify({"connected": False})

    access_token = get_valid_token(email)
    if access_token:
        return jsonify({
            "connected": True,
            "email": email,
            "lastSync": datetime.now().isoformat(),
        })

    # Token unavailable after refresh attempt
    has_refresh = bool(oauth_tokens.get(email, {}).get('refresh_token'))
    return jsonify({
        "connected": False,
        "email": email,
        "needsReconnect": not has_refresh,
        "error": "Token expired",
    })


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
            print(f"Date parsing error for {ev.get('summary')}: {parse_err}", file=sys.stderr)
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
            "originalTimezone": start.get("timeZone", "Europe/Zurich"),
            "originalDateTime": start_dt_str,
        })
    return events
