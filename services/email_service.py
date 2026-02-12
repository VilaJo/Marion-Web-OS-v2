"""
Email Service - IMAP / SMTP helpers.

Each IMAP request opens a fresh connection and closes it on exit to avoid
SSL segfaults on Python 3.14 / macOS ARM (no connection pooling).

Features:
  - Optimised listing via FLAGS + BODY.PEEK (no full RFC822 for list)
  - Real read/unread flags via IMAP STORE
  - Draft save via IMAP APPEND
  - Batch unread counts (single connection)
  - Delete, attachments (read & send), configurable server
"""

import imaplib
import smtplib
import email as email_lib
import time
import sys
import re
import logging
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from config import get_current_config

logger = logging.getLogger(__name__)
cfg = get_current_config()

# ---------------------------------------------------------------------------
# Configurable servers (Phase 2.3) — fall back to Infomaniak defaults
# ---------------------------------------------------------------------------
IMAP_HOST = getattr(cfg, 'IMAP_HOST', None) or 'mail.infomaniak.com'
IMAP_PORT = int(getattr(cfg, 'IMAP_PORT', None) or 993)
SMTP_HOST = getattr(cfg, 'SMTP_HOST', None) or 'mail.infomaniak.com'
SMTP_PORT = int(getattr(cfg, 'SMTP_PORT', None) or 465)

# Folder mapping
FOLDER_MAP = {'inbox': 'INBOX', 'sent': 'Sent', 'drafts': 'Drafts', 'trash': 'Trash'}
SENT_FALLBACKS = ['Sent', 'Sent Items', 'Sent Messages', 'INBOX.Sent']
DRAFT_FALLBACKS = ['Drafts', 'Draft', 'INBOX.Drafts']
TRASH_FALLBACKS = ['Trash', 'Deleted Items', 'Deleted Messages', 'INBOX.Trash']


# ============================================================================
# IMAP Connection — single-use (no pool) to avoid SSL segfaults on
# Python 3.14 / macOS ARM.  Each request gets its own fresh connection
# that is closed at the end of the with-block.
# ============================================================================

class _IMAPContext:
    """Context manager that creates a fresh IMAP connection and closes it on exit."""

    def __init__(self, username: str, password: str):
        self._username = username
        self._password = password
        self._conn: imaplib.IMAP4_SSL | None = None

    def __enter__(self) -> imaplib.IMAP4_SSL:
        self._conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        self._conn.login(self._username, self._password)
        return self._conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._conn:
            try:
                self._conn.logout()
            except Exception:
                pass
            self._conn = None
        return False  # Don't suppress exceptions


def imap_connection(username: str, password: str) -> _IMAPContext:
    """Get a context-managed IMAP connection (fresh per call)."""
    return _IMAPContext(username, password)


# ============================================================================
# Helpers
# ============================================================================

def clean_text(text: str) -> str:
    """Decode RFC-2047 encoded header values into a plain string."""
    if not text:
        return ""
    decoded_list = decode_header(text)
    parts = []
    for content, encoding in decoded_list:
        if isinstance(content, bytes):
            enc = encoding or 'utf-8'
            try:
                parts.append(content.decode(enc))
            except Exception:
                parts.append(content.decode('utf-8', 'ignore'))
        else:
            parts.append(str(content))
    return "".join(parts)


def _select_folder(mail: imaplib.IMAP4_SSL, folder_alias: str) -> str:
    """Select the right IMAP folder, trying fallbacks for Sent/Drafts/Trash.
    
    Accepts both known aliases ('inbox', 'sent', ...) and arbitrary IMAP
    folder names ('INBOX/ClientName', 'Clients/Acme', etc.).
    """
    # 1. Check if it's a known alias
    if folder_alias in FOLDER_MAP:
        target = FOLDER_MAP[folder_alias]
        status, _ = mail.select(target)
        if status == 'OK':
            return target

        # Try fallbacks for known folders
        fallbacks = {
            'Sent': SENT_FALLBACKS,
            'Drafts': DRAFT_FALLBACKS,
            'Trash': TRASH_FALLBACKS,
        }
        for fb in fallbacks.get(target, []):
            status, _ = mail.select(fb)
            if status == 'OK':
                return fb

        raise ValueError(f"Dossier {folder_alias} introuvable")

    # 2. Arbitrary IMAP folder name — try it directly (quoted for safety)
    status, _ = mail.select(f'"{folder_alias}"')
    if status == 'OK':
        return folder_alias

    # 3. Try without quotes
    status, _ = mail.select(folder_alias)
    if status == 'OK':
        return folder_alias

    raise ValueError(f"Dossier {folder_alias} introuvable")


def get_body_from_msg(msg) -> str:
    """Extract plain-text (or fallback HTML) body from an email.message.Message."""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get("Content-Disposition"))
            if ctype == "text/plain" and "attachment" not in cdispo:
                try:
                    return part.get_payload(decode=True).decode()
                except Exception:
                    pass
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                try:
                    return part.get_payload(decode=True).decode()
                except Exception:
                    pass
    else:
        try:
            return msg.get_payload(decode=True).decode()
        except Exception:
            pass
    return ""


def _extract_attachments_info(msg) -> list[dict]:
    """
    Extract attachment metadata (name, size, type, part index) from a message.
    Detects both explicit attachments (Content-Disposition: attachment) and
    inline files with filenames (embedded images, etc.).
    """
    attachments = []
    if not msg.is_multipart():
        # Single-part message: check if it's a non-text type with a filename
        if msg.get_filename() and msg.get_content_type() not in ("text/plain", "text/html"):
            payload = msg.get_payload(decode=True)
            attachments.append({
                "partIndex": 0,
                "filename": clean_text(msg.get_filename()),
                "contentType": msg.get_content_type(),
                "size": len(payload) if payload else 0,
            })
        return attachments

    # Skip these content types — they are structural or body text
    SKIP_TYPES = {
        "multipart/mixed", "multipart/alternative", "multipart/related",
        "multipart/signed", "multipart/report", "multipart/digest",
    }

    for idx, part in enumerate(msg.walk()):
        content_disposition = str(part.get("Content-Disposition") or "")
        content_type = part.get_content_type()
        filename = part.get_filename()

        # Explicit attachment
        is_attachment = "attachment" in content_disposition

        # Inline file with a name (embedded images, PDFs, etc.)
        is_inline_file = "inline" in content_disposition and filename

        # Any non-text, non-structural part that has a filename
        is_named_binary = (
            filename
            and content_type not in ("text/plain", "text/html")
            and content_type not in SKIP_TYPES
        )

        if is_attachment or is_inline_file or is_named_binary:
            display_name = clean_text(filename) if filename else f"attachment_{idx}"

            payload = part.get_payload(decode=True)
            size = len(payload) if payload else 0

            attachments.append({
                "partIndex": idx,
                "filename": display_name,
                "contentType": content_type,
                "size": size,
            })

    return attachments


# ============================================================================
# Core operations
# ============================================================================

def validate_credentials(username: str, password: str) -> bool:
    """Quick IMAP login check without fetching any emails."""
    try:
        conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        conn.login(username, password)
        conn.logout()
        return True
    except imaplib.IMAP4.error:
        return False


def list_emails(username: str, password: str, folder_alias: str = 'inbox',
                offset: int = 0, limit: int = 30) -> list:
    """
    Fetch emails from the given IMAP folder.
    Uses FLAGS + BODY.PEEK for efficiency (Phase 1.2).
    Returns real isUnread status from IMAP flags (Phase 1.3).
    Supports pagination via offset/limit.
    """
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder_alias)

        status, messages = mail.search(None, 'ALL')
        if status != 'OK':
            return []

        mail_ids = messages[0].split()
        if not mail_ids:
            return []

        # Apply pagination (newest first)
        mail_ids.reverse()
        paginated = mail_ids[offset:offset + limit]

        if not paginated:
            return []

        # Fetch in one batch for efficiency
        id_set = b','.join(paginated)
        status, fetch_data = mail.fetch(
            id_set,
            '(FLAGS BODY.PEEK[HEADER.FIELDS (Subject From To Date)] BODY.PEEK[TEXT]<0.300>)'
        )

        email_list = []
        # fetch_data contains alternating (envelope, body) pairs and b')'
        i = 0
        while i < len(fetch_data):
            item = fetch_data[i]
            if not isinstance(item, tuple):
                i += 1
                continue

            # item[0] is the response line with flags, item[1] is the headers
            response_line = item[0].decode('utf-8', 'ignore') if isinstance(item[0], bytes) else str(item[0])
            headers_bytes = item[1] if len(item) > 1 else b''

            # Extract message sequence number
            seq_match = re.match(r'(\d+)', response_line)
            msg_id = seq_match.group(1) if seq_match else '0'

            # Parse flags for unread and starred status
            flags_match = re.search(r'FLAGS \(([^)]*)\)', response_line)
            flags_str = flags_match.group(1) if flags_match else ''
            is_unread = '\\Seen' not in flags_str
            is_starred = '\\Flagged' in flags_str

            # Parse headers
            msg = email_lib.message_from_bytes(headers_bytes)
            subject = clean_text(msg.get("Subject", ""))
            sender = clean_text(msg.get("From", ""))
            recipient = clean_text(msg.get("To", ""))
            date_str = msg.get("Date", "")

            # Get snippet from the next item if it's the text peek
            snippet = ""
            if i + 1 < len(fetch_data) and isinstance(fetch_data[i + 1], tuple):
                snippet_bytes = fetch_data[i + 1][1] if len(fetch_data[i + 1]) > 1 else b''
                try:
                    snippet = snippet_bytes.decode('utf-8', 'ignore')[:200].replace('\n', ' ').replace('\r', ' ').strip()
                except Exception:
                    pass
                i += 1  # Skip the text part
            elif not snippet:
                # Try extracting from the same response
                try:
                    snippet = headers_bytes.decode('utf-8', 'ignore')[:100]
                except Exception:
                    pass

            if not snippet:
                snippet = ""

            email_list.append({
                "id": msg_id,
                "subject": subject or "(Sans sujet)",
                "from": sender,
                "to": recipient,
                "date": date_str,
                "snippet": snippet[:200] + ("..." if len(snippet) > 200 else ""),
                "isUnread": is_unread,
                "isStarred": is_starred,
            })

            i += 1

        # If the optimized fetch didn't work well, fall back to simple fetch
        if not email_list and paginated:
            for msg_id_bytes in paginated:
                try:
                    _, msg_data = mail.fetch(msg_id_bytes, '(FLAGS BODYSTRUCTURE RFC822.HEADER BODY.PEEK[TEXT]<0.300>)')
                    if not msg_data or not isinstance(msg_data[0], tuple):
                        continue

                    response_line = msg_data[0][0].decode('utf-8', 'ignore')
                    flags_match = re.search(r'FLAGS \(([^)]*)\)', response_line)
                    flags_str = flags_match.group(1) if flags_match else ''
                    is_unread = '\\Seen' not in flags_str
                    is_starred = '\\Flagged' in flags_str

                    # Detect attachments from BODYSTRUCTURE
                    has_attachments = '"attachment"' in response_line.lower() or '"ATTACHMENT"' in response_line

                    header_bytes = msg_data[0][1]
                    msg = email_lib.message_from_bytes(header_bytes)

                    snippet = ""
                    if len(msg_data) > 2 and isinstance(msg_data[1], tuple):
                        try:
                            snippet = msg_data[1][1].decode('utf-8', 'ignore')[:200].replace('\n', ' ').strip()
                        except Exception:
                            pass

                    email_list.append({
                        "id": msg_id_bytes.decode(),
                        "subject": clean_text(msg.get("Subject", "")) or "(Sans sujet)",
                        "from": clean_text(msg.get("From", "")),
                        "to": clean_text(msg.get("To", "")),
                        "date": msg.get("Date", ""),
                        "snippet": snippet[:200] + "..." if snippet else "",
                        "isUnread": is_unread,
                        "isStarred": is_starred,
                        "hasAttachments": has_attachments,
                    })
                except Exception:
                    pass

        # For the batch path, enrich with attachment info via BODYSTRUCTURE
        if email_list and not any(e.get("hasAttachments") is not None for e in email_list):
            try:
                id_set_for_struct = b','.join(paginated)
                _, struct_data = mail.fetch(id_set_for_struct, '(BODYSTRUCTURE)')
                # Build a map of msg_id -> hasAttachments
                attach_map: dict[str, bool] = {}
                for item in struct_data:
                    if isinstance(item, tuple):
                        line = item[0].decode('utf-8', 'ignore') if isinstance(item[0], bytes) else str(item[0])
                        seq_m = re.match(r'(\d+)', line)
                        if seq_m:
                            mid = seq_m.group(1)
                            attach_map[mid] = '"attachment"' in line.lower()
                for e in email_list:
                    e["hasAttachments"] = attach_map.get(e["id"], False)
            except Exception:
                # If BODYSTRUCTURE fetch fails, just set False
                for e in email_list:
                    if "hasAttachments" not in e:
                        e["hasAttachments"] = False

        return email_list


def get_email_body(username: str, password: str, msg_id: str,
                   folder: str = 'inbox') -> dict:
    """
    Fetch the full body + attachment metadata for a single email.
    Returns {"html": str, "attachments": list[dict]}.
    """
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)

        _, msg_data = mail.fetch(msg_id.encode(), '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw_email)
        body = get_body_from_msg(msg)
        attachments = _extract_attachments_info(msg)

        return {"html": body, "attachments": attachments}


def get_attachment(username: str, password: str, msg_id: str,
                   part_index: int, folder: str = 'inbox') -> tuple[bytes, str, str]:
    """
    Download a specific attachment by part index.
    Returns (content_bytes, filename, content_type).
    """
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)

        _, msg_data = mail.fetch(msg_id.encode(), '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email_lib.message_from_bytes(raw_email)

        for idx, part in enumerate(msg.walk()):
            if idx == part_index:
                payload = part.get_payload(decode=True)
                filename = clean_text(part.get_filename() or f"attachment_{idx}")
                content_type = part.get_content_type()
                return (payload or b'', filename, content_type)

        raise ValueError(f"Piece jointe {part_index} introuvable")


# ============================================================================
# Flags (Phase 1.3)
# ============================================================================

def mark_as_read(username: str, password: str, msg_id: str, folder: str = 'inbox'):
    """Mark an email as read via IMAP \\Seen flag."""
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)
        mail.store(msg_id.encode(), '+FLAGS', '\\Seen')


def mark_as_unread(username: str, password: str, msg_id: str, folder: str = 'inbox'):
    """Mark an email as unread by removing the \\Seen flag."""
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)
        mail.store(msg_id.encode(), '-FLAGS', '\\Seen')


# ============================================================================
# Draft (Phase 1.4)
# ============================================================================

def save_draft(username: str, password: str, to_addr: str, subject: str, body: str):
    """Save a draft email to the IMAP Drafts folder."""
    msg = MIMEMultipart()
    msg['From'] = username
    msg['To'] = to_addr
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    with imap_connection(username, password) as mail:
        # Try standard Drafts folder with fallbacks
        target = None
        for folder_name in DRAFT_FALLBACKS:
            status, _ = mail.select(folder_name)
            if status == 'OK':
                target = folder_name
                break

        if not target:
            # Create Drafts folder
            mail.create('Drafts')
            mail.select('Drafts')
            target = 'Drafts'

        mail.append(
            target,
            '\\Draft',
            imaplib.Time2Internaldate(time.time()),
            msg.as_bytes(),
        )


# ============================================================================
# Delete (Phase 2.1)
# ============================================================================

def delete_email(username: str, password: str, msg_id: str, folder: str = 'inbox'):
    """Delete an email by setting \\Deleted flag and expunging."""
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)
        mail.store(msg_id.encode(), '+FLAGS', '\\Deleted')
        mail.expunge()


# ============================================================================
# Send (with optional attachments — Phase 2.5)
# ============================================================================

def _get_logo_path():
    """Return the path to the Marion Web logo for email signatures."""
    from pathlib import Path
    # Try multiple locations
    candidates = [
        Path(__file__).resolve().parent.parent / 'static' / 'logo_marion_sig.png',
        Path('static') / 'logo_marion_sig.png',
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def send_email(username: str, password: str, to_addr: str, subject: str,
               body: str, attachments: list | None = None,
               signature_html: str | None = None):
    """
    Send an email via SMTP.
    attachments: list of (filename, content_bytes, mime_type) tuples.
    signature_html: optional HTML signature to append after the body.
                    May reference cid:marionweb_logo for the inline logo.
    """
    import html as html_mod
    from email.mime.image import MIMEImage

    # When signature uses an inline logo, we need multipart/related wrapping
    # Structure: mixed > related > alternative > (plain, html) + inline image + file attachments
    has_inline_logo = signature_html and 'cid:marionweb_logo' in signature_html
    logo_path = _get_logo_path() if has_inline_logo else None

    msg = MIMEMultipart('mixed')
    msg['From'] = username
    msg['To'] = to_addr
    msg['Subject'] = subject

    # Build text + HTML alternative part
    alt_part = MIMEMultipart('alternative')

    # Plain text version (always included)
    alt_part.attach(MIMEText(body, 'plain', 'utf-8'))

    # HTML version (body paragraphs + HTML signature)
    if signature_html:
        # Convert plain-text body to safe HTML paragraphs
        body_lines = body.rstrip().split('\n')
        body_html_parts = []
        for line in body_lines:
            escaped = html_mod.escape(line)
            if escaped.strip() == '':
                body_html_parts.append('<br>')
            else:
                body_html_parts.append(
                    f'<p style="margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif;'
                    f'font-size:14px;color:#334155;line-height:1.6">{escaped}</p>'
                )
        body_html = '\n'.join(body_html_parts)

        full_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#334155">
{body_html}
<br><br>
{signature_html}
</body></html>"""
        alt_part.attach(MIMEText(full_html, 'html', 'utf-8'))

    # If we have an inline logo, wrap in multipart/related
    if logo_path and logo_path.exists():
        related_part = MIMEMultipart('related')
        related_part.attach(alt_part)

        # Attach logo as inline CID image
        with open(logo_path, 'rb') as f:
            logo_data = f.read()
        logo_img = MIMEImage(logo_data, _subtype='png')
        logo_img.add_header('Content-ID', '<marionweb_logo>')
        logo_img.add_header('Content-Disposition', 'inline', filename='logo_marion.png')
        related_part.attach(logo_img)

        msg.attach(related_part)
    else:
        msg.attach(alt_part)

    # File attachments
    if attachments:
        for filename, content_bytes, mime_type in attachments:
            maintype, subtype = mime_type.split('/', 1) if '/' in mime_type else ('application', 'octet-stream')
            part = MIMEBase(maintype, subtype)
            part.set_payload(content_bytes)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', 'attachment', filename=filename)
            msg.attach(part)

    server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
    server.login(username, password)
    server.send_message(msg)
    server.quit()


# ============================================================================
# Batch count (Phase 1.5)
# ============================================================================

def count_emails_for_client(username: str, password: str, client_email: str) -> int:
    """Count unseen emails related to *client_email*."""
    with imap_connection(username, password) as mail:
        mail.select('INBOX')
        status, messages_data = mail.search(
            None, 'UNSEEN', 'OR', 'FROM', client_email, 'TO', client_email
        )
        if status == 'OK' and messages_data[0]:
            return len(messages_data[0].split())
        return 0


def count_emails_batch(username: str, password: str, client_emails: list[str]) -> dict[str, int]:
    """
    Count unseen emails for multiple client addresses using a single IMAP connection.
    Returns {email: count}.
    """
    results: dict[str, int] = {}
    with imap_connection(username, password) as mail:
        mail.select('INBOX')
        for ce in client_emails:
            if not isinstance(ce, str) or not ce:
                continue
            try:
                status, data = mail.search(
                    None, 'UNSEEN', 'OR', 'FROM', ce, 'TO', ce
                )
                if status == 'OK' and data[0]:
                    results[ce] = len(data[0].split())
                else:
                    results[ce] = 0
            except Exception:
                results[ce] = 0
    return results


# ============================================================================
# Star / Unstar (Flagged)
# ============================================================================

def star_email(username: str, password: str, msg_id: str, folder: str = 'inbox'):
    """Add \\Flagged flag to an email."""
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)
        mail.store(msg_id.encode(), '+FLAGS', '\\Flagged')


def unstar_email(username: str, password: str, msg_id: str, folder: str = 'inbox'):
    """Remove \\Flagged flag from an email."""
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder)
        mail.store(msg_id.encode(), '-FLAGS', '\\Flagged')


# ============================================================================
# Move email
# ============================================================================

MOVE_FOLDER_MAP = {
    'inbox': 'INBOX',
    'sent': 'Sent',
    'drafts': 'Drafts',
    'trash': 'Trash',
    'spam': 'Junk',
    'archive': 'Archive',
}
JUNK_FALLBACKS = ['Junk', 'Spam', 'INBOX.Junk', 'INBOX.Spam']
ARCHIVE_FALLBACKS = ['Archive', 'Archives', 'INBOX.Archive']


def move_email(username: str, password: str, msg_id: str,
               from_folder: str = 'inbox', to_folder: str = 'trash'):
    """
    Move an email between folders via IMAP COPY + DELETE.
    """
    with imap_connection(username, password) as mail:
        # Select source folder
        _select_folder(mail, from_folder)

        # Resolve destination folder name
        dest = MOVE_FOLDER_MAP.get(to_folder, to_folder)

        # Try to select destination to verify it exists
        status, _ = mail.select(dest)
        if status != 'OK':
            # Try fallbacks
            fallbacks_map = {
                'Junk': JUNK_FALLBACKS,
                'Trash': TRASH_FALLBACKS,
                'Archive': ARCHIVE_FALLBACKS,
            }
            found = False
            for fb in fallbacks_map.get(dest, []):
                status, _ = mail.select(fb)
                if status == 'OK':
                    dest = fb
                    found = True
                    break
            if not found:
                # Create the folder
                try:
                    mail.create(dest)
                except Exception:
                    pass

        # Re-select source
        _select_folder(mail, from_folder)

        # Copy then delete
        mail.copy(msg_id.encode(), dest)
        mail.store(msg_id.encode(), '+FLAGS', '\\Deleted')
        mail.expunge()


# ============================================================================
# Search
# ============================================================================

def search_emails(username: str, password: str, query: str,
                  folder_alias: str = 'inbox', offset: int = 0,
                  limit: int = 30) -> list:
    """
    Search emails in a folder using IMAP SEARCH.
    Searches in FROM, SUBJECT, and BODY fields.
    """
    with imap_connection(username, password) as mail:
        _select_folder(mail, folder_alias)

        # Build OR search across FROM, SUBJECT, BODY
        criteria = f'(OR OR FROM "{query}" SUBJECT "{query}" BODY "{query}")'
        status, messages = mail.search(None, criteria)
        if status != 'OK' or not messages[0]:
            return []

        mail_ids = messages[0].split()
        mail_ids.reverse()
        paginated = mail_ids[offset:offset + limit]

        if not paginated:
            return []

        # Fetch like list_emails
        email_list = []
        for msg_id_bytes in paginated:
            try:
                _, msg_data = mail.fetch(msg_id_bytes, '(FLAGS RFC822.HEADER BODY.PEEK[TEXT]<0.300>)')
                if not msg_data or not isinstance(msg_data[0], tuple):
                    continue

                response_line = msg_data[0][0].decode('utf-8', 'ignore')
                flags_match = re.search(r'FLAGS \(([^)]*)\)', response_line)
                flags_str = flags_match.group(1) if flags_match else ''
                is_unread = '\\Seen' not in flags_str
                is_starred = '\\Flagged' in flags_str

                header_bytes = msg_data[0][1]
                msg = email_lib.message_from_bytes(header_bytes)

                snippet = ""
                if len(msg_data) > 2 and isinstance(msg_data[1], tuple):
                    try:
                        snippet = msg_data[1][1].decode('utf-8', 'ignore')[:200].replace('\n', ' ').strip()
                    except Exception:
                        pass

                email_list.append({
                    "id": msg_id_bytes.decode(),
                    "subject": clean_text(msg.get("Subject", "")) or "(Sans sujet)",
                    "from": clean_text(msg.get("From", "")),
                    "to": clean_text(msg.get("To", "")),
                    "date": msg.get("Date", ""),
                    "snippet": snippet[:200] + "..." if snippet else "",
                    "isUnread": is_unread,
                    "isStarred": is_starred,
                })
            except Exception:
                pass

        return email_list


# ============================================================================
# List folders
# ============================================================================

def list_folders(username: str, password: str) -> list[dict]:
    """
    List all IMAP folders with their unseen message count.
    Returns [{"name": str, "unseen": int}, ...].

    Uses a fresh IMAP connection (many sequential IMAP calls: LIST + N × STATUS).
    """
    mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        mail.login(username, password)

        status, folder_data = mail.list()
        if status != 'OK':
            logger.warning("IMAP list() failed with status: %s", status)
            return []

        logger.info("IMAP list() returned %d items", len(folder_data) if folder_data else 0)

        folders = []
        for item in folder_data:
            if not isinstance(item, bytes):
                continue

            decoded = item.decode('utf-8', 'ignore')

            # Skip folders with \Noselect flag (can't contain messages)
            if '\\Noselect' in decoded:
                continue

            # Parse folder name from IMAP LIST response.
            # Format: (flags) "separator" "folder_name"
            folder_name = None

            # Strategy 1: match the last quoted string
            match = re.search(r'"([^"]*)"$', decoded.strip())
            if match:
                folder_name = match.group(1)
            else:
                # Strategy 2: take the last space-separated token
                parts = decoded.strip().split(' ')
                if parts:
                    folder_name = parts[-1].strip('"')

            if not folder_name:
                continue

            # Decode modified UTF-7 (IMAP uses &-encoding for non-ASCII chars)
            try:
                folder_name = _decode_imap_utf7(folder_name)
            except Exception:
                pass

            # Get unseen count
            unseen = 0
            try:
                quoted = f'"{folder_name}"'
                st, count_data = mail.status(quoted, '(UNSEEN)')
                if st == 'OK' and count_data and count_data[0]:
                    count_match = re.search(r'UNSEEN (\d+)', count_data[0].decode('utf-8', 'ignore'))
                    if count_match:
                        unseen = int(count_match.group(1))
            except Exception:
                try:
                    st, count_data = mail.status(folder_name, '(UNSEEN)')
                    if st == 'OK' and count_data and count_data[0]:
                        count_match = re.search(r'UNSEEN (\d+)', count_data[0].decode('utf-8', 'ignore'))
                        if count_match:
                            unseen = int(count_match.group(1))
                except Exception:
                    pass

            folders.append({"name": folder_name, "unseen": unseen})

        logger.info("Parsed %d IMAP folders", len(folders))
        return folders
    except Exception as e:
        logger.error("list_folders failed: %s", e)
        return []
    finally:
        try:
            mail.logout()
        except Exception:
            pass


def _decode_imap_utf7(s: str) -> str:
    """Decode IMAP modified UTF-7 folder names (& → unicode)."""
    if '&' not in s:
        return s
    result = []
    i = 0
    while i < len(s):
        if s[i] == '&':
            end_idx = s.find('-', i + 1)
            if end_idx == -1:
                result.append(s[i:])
                break
            if end_idx == i + 1:
                result.append('&')
            else:
                encoded = s[i + 1:end_idx].replace(',', '/')
                try:
                    import codecs
                    decoded = codecs.decode(b'+' + encoded.encode('ascii') + b'-', 'utf-7')
                    result.append(decoded)
                except Exception:
                    result.append(s[i:end_idx + 1])
            i = end_idx + 1
        else:
            result.append(s[i])
            i += 1
    return ''.join(result)
