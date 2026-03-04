"""
AI Provider Service - Unified local/cloud generation layer.

Supports:
- Local provider via Ollama HTTP API
- Cloud provider via Google Gemini client
- Hybrid fallback policy (local first, then cloud)
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, Generator, Optional

import requests as http_requests

from config import get_current_config
from services.logger import get_logger

logger = get_logger("services.ai_provider")
cfg = get_current_config()


def _normalize_mode(value: Optional[str]) -> str:
    mode = (value or cfg.AI_PROVIDER or "cloud").lower()
    return mode if mode in ("local", "cloud", "hybrid") else "cloud"


def _parse_ai_prefs(prefs: Optional[dict]) -> dict:
    prefs = prefs or {}
    return {
        "ai_mode": _normalize_mode(prefs.get("ai_mode")),
        "fallback_enabled": bool(prefs.get("fallback_enabled", True)),
        "local_model": prefs.get("local_model") or cfg.OLLAMA_MODEL_CHAT,
    }


def _ollama_installed_models() -> list[str]:
    try:
        resp = http_requests.get(f"{cfg.OLLAMA_BASE_URL}/api/tags", timeout=2)
        if resp.status_code != 200:
            return []
        data = resp.json() if resp.content else {}
        models = data.get("models") or []
        return [m.get("name") for m in models if isinstance(m, dict) and m.get("name")]
    except Exception:
        return []


def _resolve_ollama_model(task: str, local_model: Optional[str]) -> str:
    if local_model:
        requested = local_model
    elif task == "vision":
        requested = cfg.OLLAMA_MODEL_VISION
    elif task == "reasoning":
        requested = cfg.OLLAMA_MODEL_REASONING
    else:
        requested = cfg.OLLAMA_MODEL_CHAT

    installed = _ollama_installed_models()
    if not installed:
        return requested

    if requested in installed:
        return requested
    if ":" not in requested and f"{requested}:latest" in installed:
        return f"{requested}:latest"

    # Graceful fallback: use first available installed model instead of hard-failing.
    fallback_model = installed[0]
    logger.warning("Requested Ollama model '%s' not found, fallback to '%s'", requested, fallback_model)
    return fallback_model


def _log_ai_metric(event: str, **fields: Any) -> None:
    """Structured AI metric logs for production diagnostics."""
    payload = {"event": event, **fields}
    logger.info("ai_metric %s", json.dumps(payload, ensure_ascii=False, default=str))


def _ollama_generate(
    prompt: str,
    task: str = "chat",
    prefs: Optional[dict] = None,
    system_prompt: Optional[str] = None,
    temperature: Optional[float] = None,
) -> str:
    p = _parse_ai_prefs(prefs)
    model = _resolve_ollama_model(task, p.get("local_model"))
    timeout_s = max(1.0, float(cfg.AI_LOCAL_TIMEOUT_MS) / 1000.0)

    options: Dict[str, Any] = {}
    if temperature is not None:
        options["temperature"] = temperature

    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if options:
        payload["options"] = options
    if system_prompt:
        payload["system"] = system_prompt

    try:
        resp = http_requests.post(
            f"{cfg.OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=timeout_s,
        )
    except http_requests.Timeout:
        # Retry once with a larger timeout for heavier local models/prompts.
        retry_timeout_s = max(timeout_s, 90.0)
        logger.warning("Ollama timeout after %.1fs, retrying with %.1fs", timeout_s, retry_timeout_s)
        resp = http_requests.post(
            f"{cfg.OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=retry_timeout_s,
        )
    resp.raise_for_status()
    data = resp.json()
    return (data.get("response") or "").strip()


def _ollama_generate_multimodal(
    file_bytes: bytes,
    prompt: str,
    mime_type: str = "image/jpeg",
    prefs: Optional[dict] = None,
) -> str:
    p = _parse_ai_prefs(prefs)
    model = _resolve_ollama_model("vision", p.get("local_model"))
    timeout_s = max(1.0, float(cfg.AI_LOCAL_TIMEOUT_MS) / 1000.0)

    image_b64 = base64.b64encode(file_bytes).decode("utf-8")
    # Ollama vision endpoint consumes "images" and prompt text.
    payload = {
        "model": model,
        "prompt": f"[mime:{mime_type}] {prompt}",
        "images": [image_b64],
        "stream": False,
    }

    resp = http_requests.post(
        f"{cfg.OLLAMA_BASE_URL}/api/generate",
        json=payload,
        timeout=timeout_s,
    )
    resp.raise_for_status()
    data = resp.json()
    return (data.get("response") or "").strip()


def _gemini_generate(
    client,
    prompt: str,
    model: str,
    response_mime_type: Optional[str] = None,
    temperature: Optional[float] = None,
) -> str:
    kwargs: Dict[str, Any] = {"model": model, "contents": prompt}
    if response_mime_type is not None or temperature is not None:
        from google.genai import types

        config_kwargs: Dict[str, Any] = {}
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type
        if temperature is not None:
            config_kwargs["temperature"] = temperature
        kwargs["config"] = types.GenerateContentConfig(**config_kwargs)

    response = client.models.generate_content(**kwargs)
    return (response.text or "").strip()


def _gemini_generate_multimodal(
    client,
    file_bytes: bytes,
    prompt: str,
    model: str,
    mime_type: str = "image/jpeg",
    response_mime_type: Optional[str] = None,
) -> str:
    from google.genai import types

    kwargs: Dict[str, Any] = {
        "model": model,
        "contents": [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    types.Part.from_text(text=prompt),
                ],
            )
        ],
    }
    if response_mime_type:
        kwargs["config"] = types.GenerateContentConfig(response_mime_type=response_mime_type)

    response = client.models.generate_content(**kwargs)
    return (response.text or "").strip()


def generate_text_with_fallback(
    *,
    gemini_client,
    prompt: str,
    prefs: Optional[dict],
    cloud_model: str,
    task: str = "chat",
    system_prompt: Optional[str] = None,
    temperature: Optional[float] = None,
) -> str:
    p = _parse_ai_prefs(prefs)
    mode = p["ai_mode"]
    import time as _time
    started = _time.time()

    if mode in ("local", "hybrid"):
        try:
            out = _ollama_generate(
                prompt=prompt,
                task=task,
                prefs=p,
                system_prompt=system_prompt,
                temperature=temperature,
            )
            elapsed = int((_time.time() - started) * 1000)
            _log_ai_metric(
                "local_success",
                mode=mode,
                task=task,
                model=_resolve_ollama_model(task, p.get("local_model")),
                latency_ms=elapsed,
                prompt_chars=len(prompt),
                output_chars=len(out),
            )
            return out
        except Exception as e:
            elapsed = int((_time.time() - started) * 1000)
            _log_ai_metric(
                "local_failure",
                mode=mode,
                task=task,
                model=_resolve_ollama_model(task, p.get("local_model")),
                latency_ms=elapsed,
                error=str(e),
                fallback=(mode == "hybrid" and p["fallback_enabled"]),
            )
            if mode == "local" or not p["fallback_enabled"]:
                raise

    # cloud or fallback path
    if not gemini_client:
        raise RuntimeError("Cloud AI unavailable (Gemini client missing)")
    cloud_start = _time.time()
    out = _gemini_generate(
        client=gemini_client,
        prompt=prompt,
        model=cloud_model,
        temperature=temperature,
    )
    _log_ai_metric(
        "cloud_success",
        mode=mode,
        task=task,
        model=cloud_model,
        latency_ms=int((_time.time() - cloud_start) * 1000),
        prompt_chars=len(prompt),
        output_chars=len(out),
        fallback_used=(mode in ("local", "hybrid")),
    )
    return out


def generate_json_with_fallback(
    *,
    gemini_client,
    prompt: str,
    prefs: Optional[dict],
    cloud_model: str,
    task: str = "reasoning",
    system_prompt: Optional[str] = None,
) -> dict:
    text = generate_text_with_fallback(
        gemini_client=gemini_client,
        prompt=prompt + "\n\nReturn strict JSON only.",
        prefs=prefs,
        cloud_model=cloud_model,
        task=task,
        system_prompt=system_prompt,
    )
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


def generate_multimodal_with_fallback(
    *,
    gemini_client,
    file_bytes: bytes,
    prompt: str,
    prefs: Optional[dict],
    cloud_model: str,
    mime_type: str = "image/jpeg",
    response_mime_type: Optional[str] = None,
) -> str:
    p = _parse_ai_prefs(prefs)
    mode = p["ai_mode"]
    import time as _time
    started = _time.time()

    if mode in ("local", "hybrid"):
        try:
            out = _ollama_generate_multimodal(
                file_bytes=file_bytes,
                prompt=prompt,
                mime_type=mime_type,
                prefs=p,
            )
            _log_ai_metric(
                "local_multimodal_success",
                mode=mode,
                model=_resolve_ollama_model("vision", p.get("local_model")),
                latency_ms=int((_time.time() - started) * 1000),
                mime_type=mime_type,
                bytes=len(file_bytes),
                output_chars=len(out),
            )
            return out
        except Exception as e:
            _log_ai_metric(
                "local_multimodal_failure",
                mode=mode,
                model=_resolve_ollama_model("vision", p.get("local_model")),
                latency_ms=int((_time.time() - started) * 1000),
                mime_type=mime_type,
                bytes=len(file_bytes),
                error=str(e),
                fallback=(mode == "hybrid" and p["fallback_enabled"]),
            )
            if mode == "local" or not p["fallback_enabled"]:
                raise

    if not gemini_client:
        raise RuntimeError("Cloud AI unavailable (Gemini client missing)")
    cloud_start = _time.time()
    out = _gemini_generate_multimodal(
        client=gemini_client,
        file_bytes=file_bytes,
        prompt=prompt,
        model=cloud_model,
        mime_type=mime_type,
        response_mime_type=response_mime_type,
    )
    _log_ai_metric(
        "cloud_multimodal_success",
        mode=mode,
        model=cloud_model,
        latency_ms=int((_time.time() - cloud_start) * 1000),
        mime_type=mime_type,
        bytes=len(file_bytes),
        output_chars=len(out),
        fallback_used=(mode in ("local", "hybrid")),
    )
    return out


def stream_text_with_fallback(
    *,
    gemini_client,
    contents: list,
    prefs: Optional[dict],
    cloud_model: str,
    task: str = "chat",
    system_prompt: Optional[str] = None,
    temperature: Optional[float] = None,
) -> Generator[str, None, None]:
    p = _parse_ai_prefs(prefs)
    mode = p["ai_mode"]
    import time as _time
    started = _time.time()

    if mode in ("local", "hybrid"):
        try:
            # For local models, emulate streaming by chunking final text.
            text_parts = []
            for item in contents:
                if isinstance(item, dict):
                    for part in item.get("parts", []):
                        if isinstance(part, dict) and part.get("text"):
                            text_parts.append(part["text"])
            prompt = "\n".join(text_parts).strip()
            txt = _ollama_generate(
                prompt=prompt,
                task=task,
                prefs=p,
                system_prompt=system_prompt,
                temperature=temperature,
            )
            chunk_size = 120
            for i in range(0, len(txt), chunk_size):
                yield txt[i : i + chunk_size]
            _log_ai_metric(
                "local_stream_emulated_success",
                mode=mode,
                task=task,
                model=_resolve_ollama_model(task, p.get("local_model")),
                latency_ms=int((_time.time() - started) * 1000),
                output_chars=len(txt),
            )
            return
        except Exception as e:
            _log_ai_metric(
                "local_stream_failure",
                mode=mode,
                task=task,
                model=_resolve_ollama_model(task, p.get("local_model")),
                latency_ms=int((_time.time() - started) * 1000),
                error=str(e),
                fallback=(mode == "hybrid" and p["fallback_enabled"]),
            )
            if mode == "local" or not p["fallback_enabled"]:
                raise

    if not gemini_client:
        raise RuntimeError("Cloud AI unavailable (Gemini client missing)")

    from google.genai import types

    cloud_start = _time.time()
    stream = gemini_client.models.generate_content_stream(
        model=cloud_model,
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=temperature if temperature is not None else 0.7,
            max_output_tokens=700,
        ),
    )
    emitted = 0
    for chunk in stream:
        if chunk.text:
            emitted += len(chunk.text)
            yield chunk.text
    _log_ai_metric(
        "cloud_stream_success",
        mode=mode,
        task=task,
        model=cloud_model,
        latency_ms=int((_time.time() - cloud_start) * 1000),
        output_chars=emitted,
        fallback_used=(mode in ("local", "hybrid")),
    )

