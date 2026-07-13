"""
Audit Blueprint - WordPress site audit & deploy checklist

Endpoints:
  POST /audit/wp-prospect   — URL -> Lighthouse via PageSpeed Insights API
                              + Gemini analysis of plugins/risks + sales pitch
  POST /audit/deploy-check  — preview URL -> deploy checklist (meta/sitemap/robots/og/lighthouse)

Uses PageSpeed Insights public REST API (no key required for low volume,
optionally PSI_API_KEY env var for higher quotas).
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from flask import Blueprint, request, jsonify

from services.gemini_service import get_client, is_configured
from services.logger import get_logger
from services.ai_provider_service import generate_json_with_fallback
from database.db import get_workspace_settings

logger = get_logger('api.audit')

audit_bp = Blueprint('audit', __name__, url_prefix='/api/v1')

PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
PSI_TIMEOUT = 60


def _resolve_ai_prefs():
    try:
        return get_workspace_settings(1).get('aiPreferences')
    except Exception:
        return None


def _validate_url(url: str) -> str:
    """Sanitise/validate a URL. Returns canonical url or raises ValueError."""
    if not url or not isinstance(url, str):
        raise ValueError("URL requise")
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    parsed = urlparse(url)
    if not parsed.netloc:
        raise ValueError("URL invalide")
    if parsed.scheme not in ('http', 'https'):
        raise ValueError("Seuls http/https sont supportés")
    # Block private/local addresses
    host = parsed.hostname or ''
    if host in ('localhost', '127.0.0.1', '0.0.0.0') or host.startswith(('192.168.', '10.', '172.16.')):
        raise ValueError("URL privée non supportée")
    return url


def _run_pagespeed(url: str, strategy: str = "mobile") -> dict:
    """Run PageSpeed Insights for a URL, return summarised scores."""
    params = {
        "url": url,
        "strategy": strategy,
        "category": ["performance", "accessibility", "seo", "best-practices"],
    }
    api_key = os.environ.get('PSI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if api_key:
        params["key"] = api_key
    try:
        resp = requests.get(PSI_ENDPOINT, params=params, timeout=PSI_TIMEOUT)
        if resp.status_code != 200:
            logger.warning("PageSpeed returned %s for %s", resp.status_code, url)
            return {
                "available": False,
                "error": f"PageSpeed HTTP {resp.status_code}",
            }
        data = resp.json()
        categories = data.get('lighthouseResult', {}).get('categories', {})

        def score(cat_id):
            v = (categories.get(cat_id) or {}).get('score')
            return int(round(v * 100)) if isinstance(v, (int, float)) else None

        # Core Web Vitals from audits
        audits = data.get('lighthouseResult', {}).get('audits', {})

        def metric(audit_id):
            v = (audits.get(audit_id) or {}).get('displayValue')
            return v

        return {
            "available": True,
            "strategy": strategy,
            "scores": {
                "performance": score('performance'),
                "accessibility": score('accessibility'),
                "seo": score('seo'),
                "best_practices": score('best-practices'),
            },
            "metrics": {
                "lcp": metric('largest-contentful-paint'),
                "fcp": metric('first-contentful-paint'),
                "cls": metric('cumulative-layout-shift'),
                "tbt": metric('total-blocking-time'),
                "speed_index": metric('speed-index'),
            },
        }
    except requests.exceptions.Timeout:
        return {"available": False, "error": "PageSpeed timeout"}
    except Exception as e:
        logger.error("PageSpeed call failed: %s", e)
        return {"available": False, "error": "PageSpeed exception"}


# ---------------------------------------------------------------------------
# Lightweight HTML probe (head + first ~100 KB of body)
# ---------------------------------------------------------------------------

def _probe_html(url: str) -> dict:
    """Fetch the HTML and extract WP markers, meta tags, plugins, etc."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Eonora Tech OS Audit/1.0)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20, allow_redirects=True, stream=True)
        if resp.status_code >= 400:
            return {"available": False, "error": f"HTTP {resp.status_code}"}
        # Read up to 200 KB
        chunks = []
        size = 0
        for chunk in resp.iter_content(chunk_size=8192):
            chunks.append(chunk)
            size += len(chunk)
            if size > 200_000:
                break
        html = b"".join(chunks).decode('utf-8', errors='ignore')
    except Exception as e:
        logger.warning("HTML probe failed for %s: %s", url, e)
        return {"available": False, "error": "Fetch failed"}

    # Extract markers
    title_m = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    desc_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', html, re.IGNORECASE)
    og_image_m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.IGNORECASE)
    og_title_m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', html, re.IGNORECASE)
    favicon_m = re.search(r'<link[^>]+rel=["\'](?:icon|shortcut icon)["\']', html, re.IGNORECASE)
    canonical_m = re.search(r'<link[^>]+rel=["\']canonical["\']', html, re.IGNORECASE)
    viewport_m = re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.IGNORECASE)

    # WP detection
    wp_signals = {
        'wp-content': '/wp-content/' in html,
        'wp-includes': '/wp-includes/' in html,
        'wp_emoji': 'wp-emoji-release.min.js' in html or 'wpemojiSettings' in html,
        'generator_meta': bool(re.search(r'<meta[^>]+name=["\']generator["\'][^>]+WordPress', html, re.IGNORECASE)),
    }
    is_wordpress = any(wp_signals.values())

    # Detect popular plugins / themes from /wp-content/{plugins|themes}/{name}/
    plugin_matches = set(re.findall(r'/wp-content/plugins/([a-z0-9_\-]+)/', html, re.IGNORECASE))
    theme_matches = set(re.findall(r'/wp-content/themes/([a-z0-9_\-]+)/', html, re.IGNORECASE))

    # Misc
    has_jquery = 'jquery' in html.lower()
    has_react_root = 'id="root"' in html or 'id="__next"' in html
    has_vue = 'data-v-' in html or '__vue__' in html
    builder_signals = {
        'elementor': 'elementor' in html.lower(),
        'divi': 'et_pb_' in html or 'divi' in html.lower(),
        'wpbakery': 'vc_row' in html,
        'beaver': 'fl-builder' in html,
        'gutenberg': 'wp-block-' in html,
    }

    return {
        "available": True,
        "title": (title_m.group(1).strip() if title_m else None),
        "meta_description": (desc_m.group(1).strip() if desc_m else None),
        "og_image": og_image_m.group(1) if og_image_m else None,
        "og_title": og_title_m.group(1) if og_title_m else None,
        "has_favicon": bool(favicon_m),
        "has_canonical": bool(canonical_m),
        "has_viewport": bool(viewport_m),
        "is_wordpress": is_wordpress,
        "wp_signals": wp_signals,
        "wp_plugins": sorted(plugin_matches)[:20],
        "wp_themes": sorted(theme_matches)[:5],
        "stack_signals": {
            "jquery": has_jquery,
            "react": has_react_root,
            "vue": has_vue,
        },
        "builder_signals": builder_signals,
    }


def _check_url_status(url: str) -> dict:
    """Lightweight HEAD probe for sitemap.xml / robots.txt etc."""
    try:
        resp = requests.head(url, timeout=10, allow_redirects=True)
        return {"status": resp.status_code, "ok": 200 <= resp.status_code < 400}
    except Exception:
        return {"status": None, "ok": False}


# ---------------------------------------------------------------------------
# /audit/wp-prospect
# ---------------------------------------------------------------------------

@audit_bp.route('/audit/wp-prospect', methods=['POST'])
def audit_wp_prospect():
    """Audit a prospect's WordPress site — Lighthouse + plugin detection +
    cost estimate + sales pitch."""
    body = request.get_json(silent=True) or {}
    raw_url = body.get('url', '')
    try:
        url = _validate_url(raw_url)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not is_configured():
        return jsonify({"error": "Gemini n'est pas configuré."}), 503

    # 1) Probe HTML (fast)
    probe = _probe_html(url)

    # 2) Lighthouse via PageSpeed Insights (slower)
    lighthouse_mobile = _run_pagespeed(url, strategy="mobile")

    # 3) AI summary / sales pitch / cost
    ai_input = {
        "url": url,
        "title": probe.get('title'),
        "meta_description": probe.get('meta_description'),
        "is_wordpress": probe.get('is_wordpress'),
        "plugins": probe.get('wp_plugins', []),
        "themes": probe.get('wp_themes', []),
        "builder_signals": probe.get('builder_signals', {}),
        "lighthouse": lighthouse_mobile.get('scores', {}),
        "lighthouse_metrics": lighthouse_mobile.get('metrics', {}),
        "missing": [
            field for field in ['has_favicon', 'has_canonical', 'has_viewport', 'meta_description', 'og_image']
            if not probe.get(field)
        ],
    }

    prompt = f"""Tu es un consultant web qui audite des sites WordPress pour aider Marion à pitcher une refonte.

Données collectées :
{json.dumps(ai_input, ensure_ascii=False, indent=2)}

Produis un audit structuré et un argumentaire de vente.

Pour le coût annuel WP, estime :
- hébergement managé (~120-300 €/an)
- maintenance plugins/sécu (~400-800 €/an si Marion gère, plus si agence)
- licences Premium détectées (Elementor Pro, WP Rocket, Yoast, etc.) (~50-200 €/an chacune)

Pour le coût d'un site sur-mesure (Cursor + Vercel + Sanity), estime un cout "marche / an" :
- 0 € hébergement (tier gratuit Vercel)
- 0 € maintenance plugins (pas de plugins)
- éventuellement Sanity (free tier ou ~99 $/mois si gros)

Liste les 3-5 risques principaux (sécurité, perf, dépendances obsolètes).
Donne 3 opportunités concrètes pour pitcher la refonte.
Termine par un argumentaire de vente en markdown (3-4 paragraphes punchy, prêt à coller dans un mail).

JSON strict :
{{
  "site": {{
    "url": "{url}",
    "title": "...",
    "is_wordpress": true,
    "lighthouse_scores": {{ "performance": 45, "accessibility": 80, "seo": 70, "best_practices": 60 }},
    "core_web_vitals": {{ "lcp": "3.2 s", "cls": "0.18" }}
  }},
  "wp_findings": {{
    "plugins_detected": ["elementor", "yoast-seo"],
    "themes_detected": ["hello-elementor"],
    "builder": "Elementor"
  }},
  "risks": [
    {{ "severity": "high", "title": "...", "detail": "..." }}
  ],
  "annual_cost_wp_eur": {{ "hosting": 200, "maintenance": 600, "licenses": 250, "total": 1050 }},
  "annual_cost_custom_eur": {{ "hosting": 0, "maintenance": 0, "licenses": 0, "total": 0 }},
  "savings_per_year_eur": 1050,
  "opportunities": ["...", "...", "..."],
  "sales_pitch_markdown": "## Pourquoi refondre {url}..."
}}"""

    gemini_client = get_client()
    prefs = _resolve_ai_prefs()
    try:
        ai_result = generate_json_with_fallback(
            gemini_client=gemini_client,
            prompt=prompt,
            prefs=prefs,
            cloud_model="gemini-2.0-flash",
        )
    except Exception as e:
        logger.error("WP audit AI synthesis failed: %s", e)
        ai_result = {
            "site": {"url": url},
            "error": "Analyse IA partielle",
        }

    # Merge raw lighthouse data so the frontend has metric strings
    return jsonify({
        "url": url,
        "audited_at": int(time.time()),
        "probe": probe,
        "lighthouse_mobile": lighthouse_mobile,
        "ai": ai_result,
    })


# ---------------------------------------------------------------------------
# /audit/deploy-check
# ---------------------------------------------------------------------------

@audit_bp.route('/audit/deploy-check', methods=['POST'])
def deploy_check():
    """Pre-deploy checklist for a preview URL — verifies sitemap, robots,
    metadata, OG, lighthouse perf score."""
    body = request.get_json(silent=True) or {}
    raw_url = body.get('url', '')
    try:
        url = _validate_url(raw_url)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    # 1) Probe HTML
    probe = _probe_html(url)

    # 2) Sitemap & robots
    sitemap = _check_url_status(f"{base}/sitemap.xml")
    robots = _check_url_status(f"{base}/robots.txt")
    favicon = _check_url_status(f"{base}/favicon.ico")

    # 3) Lighthouse (only mobile to keep fast)
    lh = _run_pagespeed(url, strategy="mobile")

    checks = [
        {"id": "title", "label": "Balise <title> renseignée", "passed": bool(probe.get('title')), "detail": probe.get('title') or "Manquant"},
        {"id": "description", "label": "Meta description présente", "passed": bool(probe.get('meta_description')), "detail": probe.get('meta_description') or "Manquant"},
        {"id": "viewport", "label": "Meta viewport (mobile)", "passed": bool(probe.get('has_viewport')), "detail": "Présent" if probe.get('has_viewport') else "Manquant — risque mobile"},
        {"id": "canonical", "label": "Canonical URL", "passed": bool(probe.get('has_canonical')), "detail": "Présent" if probe.get('has_canonical') else "Risque de duplicate content SEO"},
        {"id": "favicon", "label": "Favicon", "passed": bool(probe.get('has_favicon')) or favicon.get('ok', False), "detail": "OK" if favicon.get('ok') else "Vérifie /favicon.ico"},
        {"id": "og_image", "label": "Open Graph image (partage social)", "passed": bool(probe.get('og_image')), "detail": probe.get('og_image') or "Manquant"},
        {"id": "og_title", "label": "Open Graph title", "passed": bool(probe.get('og_title')), "detail": probe.get('og_title') or "Manquant"},
        {"id": "sitemap", "label": "/sitemap.xml accessible", "passed": sitemap.get('ok', False), "detail": f"HTTP {sitemap.get('status')}" if sitemap.get('status') else "Inaccessible"},
        {"id": "robots", "label": "/robots.txt accessible", "passed": robots.get('ok', False), "detail": f"HTTP {robots.get('status')}" if robots.get('status') else "Inaccessible"},
    ]
    perf_score = (lh.get('scores') or {}).get('performance')
    if perf_score is not None:
        checks.append({
            "id": "lighthouse_perf",
            "label": "Lighthouse perf ≥ 80",
            "passed": perf_score >= 80,
            "detail": f"Score : {perf_score}/100",
        })
    a11y_score = (lh.get('scores') or {}).get('accessibility')
    if a11y_score is not None:
        checks.append({
            "id": "lighthouse_a11y",
            "label": "Lighthouse a11y ≥ 90",
            "passed": a11y_score >= 90,
            "detail": f"Score : {a11y_score}/100",
        })
    seo_score = (lh.get('scores') or {}).get('seo')
    if seo_score is not None:
        checks.append({
            "id": "lighthouse_seo",
            "label": "Lighthouse SEO ≥ 90",
            "passed": seo_score >= 90,
            "detail": f"Score : {seo_score}/100",
        })

    passed_count = sum(1 for c in checks if c['passed'])
    total = len(checks)

    return jsonify({
        "url": url,
        "checked_at": int(time.time()),
        "checks": checks,
        "passed": passed_count,
        "total": total,
        "ready_to_deploy": passed_count >= total - 1,
        "lighthouse": lh,
    })
