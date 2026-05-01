"""
Claude Service - Anthropic Claude client integration.

Provides text generation via the Anthropic API (claude-sonnet-4-6, claude-haiku-4-5,
claude-opus-4-7) as a third AI provider alongside Gemini and Ollama.

Model aliases used here are kept up-to-date with Anthropic's currently active models.
See: https://docs.anthropic.com/en/docs/about-claude/models/all-models
"""

from __future__ import annotations

import json
from typing import Optional, Generator

from config import get_current_config
from services.logger import get_logger
from database.db import get_workspace_settings, update_workspace_settings

logger = get_logger('services.claude')
cfg = get_current_config()

_client = None
_api_key_cache: Optional[str] = None


def _get_api_key() -> Optional[str]:
    """Load key from workspace_settings DB, with in-memory cache."""
    global _api_key_cache
    if _api_key_cache is not None:
        return _api_key_cache
    try:
        settings = get_workspace_settings(1)
        key = (settings.get('anthropicApiKey') or '').strip()
        _api_key_cache = key if key else None
        return _api_key_cache
    except Exception:
        return None


def invalidate_key_cache():
    global _api_key_cache, _client
    _api_key_cache = None
    _client = None


def get_client():
    """Return an Anthropic client, lazily initialising from DB key."""
    global _client
    if _client is not None:
        return _client
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        import anthropic
        _client = anthropic.Anthropic(api_key=api_key)
        logger.info("Anthropic Claude client initialized")
        return _client
    except Exception as e:
        logger.error("Claude client init failed: %s", e)
        return None


def is_configured() -> bool:
    return bool(_get_api_key())


def save_api_key(key: str):
    key = key.strip()
    settings = get_workspace_settings(1)
    settings['anthropicApiKey'] = key
    update_workspace_settings(1, settings)
    invalidate_key_cache()


def remove_api_key():
    settings = get_workspace_settings(1)
    settings.pop('anthropicApiKey', None)
    update_workspace_settings(1, settings)
    invalidate_key_cache()


# Default = balanced model for most analyses (cost / quality sweet-spot)
DEFAULT_MODEL = "claude-sonnet-4-6"
# Fast = cheap + fast for quick checks (validation, short answers)
FAST_MODEL = "claude-haiku-4-5"
# Power = highest reasoning, used for code review / strategy
POWER_MODEL = "claude-opus-4-7"


def generate_text(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    client = get_client()
    if not client:
        raise RuntimeError("Claude not configured — add your Anthropic API key in Settings")

    messages = [{"role": "user", "content": prompt}]
    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=messages,
    )
    if system_prompt:
        kwargs["system"] = system_prompt

    response = client.messages.create(**kwargs)
    return response.content[0].text.strip()


def generate_json(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
) -> dict:
    text = generate_text(
        prompt=prompt + "\n\nReturn strict JSON only, no markdown fences.",
        model=model,
        system_prompt=system_prompt,
        temperature=0.3,
    )
    cleaned = text.replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start != -1 and end > start:
        cleaned = cleaned[start:end]
    return json.loads(cleaned)


def stream_text(
    messages: list,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> Generator[str, None, None]:
    client = get_client()
    if not client:
        raise RuntimeError("Claude not configured")

    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=messages,
    )
    if system_prompt:
        kwargs["system"] = system_prompt

    with client.messages.stream(**kwargs) as stream:
        for text in stream.text_stream:
            yield text
