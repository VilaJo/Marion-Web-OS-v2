"""
Calendar Blueprint - Local macOS Calendar (iCal) routes.
Handles: fetch, sync (create), update, delete
Note: Google Calendar routes are in oauth_bp.py.
"""

import subprocess
from flask import Blueprint, request, jsonify

from api.shared import DESKTOP_PATH, error_response

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/v1/calendar')


@calendar_bp.route('/fetch', methods=['GET'])
def fetch_calendar():
    """Fetch events from macOS Calendar (iCal) via AppleScript."""
    print("Fetching calendar events (V3)...")

    script = '''
    set eventList to {}

    set startDate to (current date) - (30 * days)
    set endDate to (current date) + (90 * days)

    tell application "Calendar"
        set allCalendars to every calendar

        repeat with cal in allCalendars
            set calName to name of cal

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

                                set debugStr to evId & "|||" & evTitle & "|||" & y & "-" & m & "-" & d & "|||" & h & ":" & mn & "|||" & dur & "|||" & calName & "|||" & evDesc
                                set end of eventList to debugStr
                            end try
                        end repeat
                    end tell
                on error errMsg
                    -- skip
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
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)

        if result.returncode != 0:
            print(f"AppleScript Error: {result.stderr}")
            return jsonify({"events": [], "error": result.stderr})

        if result.stdout:
            raw_data = result.stdout.strip().split('@@@')
            print(f"AppleScript found {len(raw_data)} raw elements.")

            for line in raw_data:
                if not line.strip():
                    continue
                parts = line.split('|||')

                if len(parts) >= 6:
                    date_parts = parts[2].split('-')
                    formatted_date = f"{date_parts[0]}-{int(date_parts[1]):02d}-{int(date_parts[2]):02d}"
                    time_parts = parts[3].split(':')
                    formatted_time = f"{int(time_parts[0]):02d}:{int(time_parts[1]):02d}"
                    cal_name = parts[5]

                    event_type = 'Personal'
                    lower_name = cal_name.lower()
                    lower_title = parts[1].lower()

                    if any(x in lower_name for x in ['travail', 'work', 'pro', 'job', 'client']):
                        event_type = 'Meeting'
                    elif 'anniversaire' in lower_name:
                        event_type = 'Personal'
                    elif 'deadline' in lower_name:
                        event_type = 'Deadline'
                    if 'deadline' in lower_title or 'rendu' in lower_title:
                        event_type = 'Deadline'
                    if 'focus' in lower_title:
                        event_type = 'Focus'

                    events.append({
                        "id": parts[0] if parts[0] != "no-uid" else f"ical-{parts[1]}-{formatted_date}",
                        "title": parts[1],
                        "date": formatted_date,
                        "startTime": formatted_time,
                        "duration": int(float(parts[4].replace(',', '.'))),
                        "calendarName": cal_name,
                        "description": parts[6] if len(parts) > 6 else "",
                        "type": event_type,
                        "source": "iCal",
                    })
            print(f"{len(events)} events parsed successfully.")
        else:
            print("No stdout from AppleScript.")
    except Exception as e:
        print(f"Exception in fetch_calendar: {e}")

    return jsonify({"events": events})


@calendar_bp.route('/sync', methods=['POST'])
def create_calendar_event():
    """Create a new event in macOS Calendar via AppleScript."""
    data = request.json
    try:
        title = data.get('title', 'Nouvel evenement')
        date_str = data.get('startDate')
        time_str = data.get('startTime')
        duration_hours = float(data.get('duration', 1))

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
        return error_response(e)


@calendar_bp.route('/update', methods=['POST'])
def update_calendar_event():
    """Update an existing calendar event (placeholder)."""
    data = request.json
    try:
        print(f"Update request received for: {data.get('title')}")
        return jsonify({"success": True})
    except Exception as e:
        return error_response(e)


@calendar_bp.route('/delete', methods=['POST'])
def delete_calendar_event():
    """Delete a local calendar event (placeholder)."""
    event_id = request.args.get('id') or (request.json or {}).get('id')
    if not event_id:
        return jsonify({"error": "Event ID required"}), 400
    return jsonify({"success": True, "message": "Event deletion noted"})
