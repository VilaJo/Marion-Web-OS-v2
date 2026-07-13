"""
Meeting transcription helpers.
Cloud-first fallback strategy:
- If browser live transcript is present, keep it as source of truth.
- If missing/too short and audio bytes exist, request AI multimodal transcription.
"""

from services.logger import get_logger
from services.ai_provider_service import generate_multimodal_with_fallback

logger = get_logger("services.meeting_transcription")


def transcribe_audio_fallback(audio_bytes: bytes, ai_prefs: dict, gemini_client=None) -> str:
    """Best-effort server-side transcription fallback."""
    if not audio_bytes:
        return ""
    prompt = (
        "Transcris fidèlement cet audio de reunion en francais.\n"
        "Retourne uniquement du texte brut (pas de markdown).\n"
        "Conserve les informations factuelles importantes."
    )
    try:
        text = generate_multimodal_with_fallback(
            gemini_client=gemini_client,
            file_bytes=audio_bytes,
            prompt=prompt,
            prefs=ai_prefs,
            cloud_model="gemini-2.5-flash",
            mime_type="audio/webm",
            response_mime_type="text/plain",
            task="chat",
        )
        return (text or "").strip()
    except Exception as exc:
        logger.warning("meeting.transcription_fallback.failed: %s", exc)
        return ""

