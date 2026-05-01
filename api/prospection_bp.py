"""
Prospection Blueprint - International lead prospecting.

Uses Apollo.io as the primary data source. Falls back to Gemini AI
when Apollo credits are exhausted (HTTP 422) or rate-limited (HTTP 429).
The fallback is re-attempted after APOLLO_RETRY_AFTER_SECONDS.
"""

import hashlib
import json
import random
import time
from flask import Blueprint, request, jsonify
from config import get_current_config
from services.logger import get_logger
from services.gemini_service import get_client
from services.ai_provider_service import generate_json_with_fallback, generate_text_with_fallback
from database.db import get_workspace_settings, update_workspace_settings

import requests as http_requests

logger = get_logger('api.prospection')
prospection_bp = Blueprint('prospection', __name__)

# ---------------------------------------------------------------------------
# In-memory Apollo key (loaded from DB at first use)
# ---------------------------------------------------------------------------
_apollo_key_cache: str | None = None  # None = not yet loaded


def _get_apollo_key() -> str:
    """Return the Apollo API key. Priority: DB setting > env config."""
    global _apollo_key_cache
    if _apollo_key_cache is None:
        try:
            settings = get_workspace_settings(1)
            _apollo_key_cache = settings.get('apolloApiKey', '') or ''
        except Exception:
            _apollo_key_cache = ''
    # If DB has no key, fall back to env/config
    if not _apollo_key_cache:
        cfg = get_current_config()
        return getattr(cfg, 'APOLLO_API_KEY', '')
    return _apollo_key_cache


def _invalidate_apollo_key_cache():
    global _apollo_key_cache
    _apollo_key_cache = None


# ---------------------------------------------------------------------------
# Module-level Apollo availability flag with cooldown
# ---------------------------------------------------------------------------
_apollo_available: bool = True
_apollo_disabled_at: float = 0.0
APOLLO_RETRY_AFTER_SECONDS = 3600  # re-try Apollo after 1 hour

# ---------------------------------------------------------------------------
# Results cache (in-memory, TTL = 5 min)
# ---------------------------------------------------------------------------
_search_cache: dict = {}
_CACHE_TTL = 300  # seconds


def _cache_key(filters: dict, page: int) -> str:
    raw = json.dumps({**filters, "page": page}, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_get(key: str) -> dict | None:
    entry = _search_cache.get(key)
    if entry and (time.time() - entry["ts"] < _CACHE_TTL):
        return entry["data"]
    return None


def _cache_set(key: str, data: dict):
    _search_cache[key] = {"data": data, "ts": time.time()}


def _is_apollo_available() -> bool:
    global _apollo_available, _apollo_disabled_at
    if not _apollo_available:
        if time.time() - _apollo_disabled_at >= APOLLO_RETRY_AFTER_SECONDS:
            logger.info("Apollo cooldown expired — re-enabling Apollo source")
            _apollo_available = True
    return _apollo_available


def _disable_apollo(reason: str):
    global _apollo_available, _apollo_disabled_at
    _apollo_available = False
    _apollo_disabled_at = time.time()
    logger.warning("Apollo source disabled: %s. Will retry in %ds", reason, APOLLO_RETRY_AFTER_SECONDS)


# ---------------------------------------------------------------------------
# Apollo helpers
# ---------------------------------------------------------------------------
APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/search"

EMPLOYEE_RANGES = {
    "1,10":   [{"min": 1,   "max": 10}],
    "11,50":  [{"min": 11,  "max": 50}],
    "51,200": [{"min": 51,  "max": 200}],
    "201+":   [{"min": 201, "max": 1000000}],
}


def _call_apollo(filters: dict, api_key: str, page: int = 1) -> dict:
    """Call Apollo People Search and return normalised results."""
    payload = {
        "page": page,
        "per_page": 10,
    }

    if filters.get("title"):
        payload["person_titles"] = [filters["title"]]

    if filters.get("country"):
        payload["person_locations"] = [filters["country"]]

    if filters.get("industry"):
        payload["q_organization_keyword_tags"] = [filters["industry"]]

    if filters.get("keyword"):
        payload["q_keywords"] = filters["keyword"]

    if filters.get("organization_name"):
        payload["organization_names"] = [filters["organization_name"]]

    employee_count = filters.get("employee_count", "")
    if employee_count and employee_count in EMPLOYEE_RANGES:
        payload["organization_num_employees_ranges"] = EMPLOYEE_RANGES[employee_count]

    resp = http_requests.post(
        APOLLO_SEARCH_URL,
        json=payload,
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        timeout=15,
    )

    if resp.status_code in (422, 429):
        raise ApolloCreditsError(resp.status_code, resp.text)

    resp.raise_for_status()
    data = resp.json()

    people = data.get("people") or []
    results = []
    for p in people:
        org = p.get("organization") or {}
        results.append({
            "name": p.get("name") or "",
            "title": p.get("title") or "",
            "company": org.get("name") or p.get("organization_name") or "",
            "country": p.get("country") or "",
            "email": p.get("email") or "",   # Apollo provides real emails on paid plan
            "website": org.get("website_url") or "",
            "linkedin": p.get("linkedin_url") or "",
            "source": "apollo",
        })

    pagination = data.get("pagination") or {}
    total_entries = pagination.get("total_entries") or len(results)
    credits = data.get("credits_remaining") if "credits_remaining" in data else None

    return {"results": results, "credits_remaining": credits, "total_entries": total_entries}


class ApolloCreditsError(Exception):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        super().__init__(f"Apollo HTTP {status_code}: {body[:200]}")


# ---------------------------------------------------------------------------
# Hunter.io email enrichment
# ---------------------------------------------------------------------------
import re as _re
import unicodedata as _unicodedata

HUNTER_FINDER_URL = "https://api.hunter.io/v2/email-finder"
_hunter_key_cache: str | None = None


def _get_hunter_key() -> str:
    global _hunter_key_cache
    if _hunter_key_cache is None:
        try:
            settings = get_workspace_settings(1)
            _hunter_key_cache = settings.get('hunterApiKey', '') or ''
        except Exception:
            _hunter_key_cache = ''
    if not _hunter_key_cache:
        cfg = get_current_config()
        return getattr(cfg, 'HUNTER_API_KEY', '') or ''
    return _hunter_key_cache


def _invalidate_hunter_key_cache():
    global _hunter_key_cache
    _hunter_key_cache = None


def _extract_domain(website: str) -> str:
    """Extract bare domain from a URL (https://www.example.com → example.com)."""
    website = (website or "").strip()
    website = _re.sub(r"^https?://", "", website)
    website = _re.sub(r"^www\.", "", website)
    domain = website.split("/")[0].split("?")[0]
    return domain.lower()


def _hunter_find_email(name: str, domain: str, api_key: str) -> str:
    """
    Call Hunter.io Email Finder API.
    Returns verified email string or empty string if not found.
    """
    if not domain or not api_key:
        return ""
    parts = (name or "").strip().split()
    if len(parts) < 2:
        return ""
    params = {
        "domain": domain,
        "first_name": parts[0],
        "last_name": " ".join(parts[1:]),
        "api_key": api_key,
    }
    try:
        resp = http_requests.get(HUNTER_FINDER_URL, params=params, timeout=8)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            email = data.get("email") or ""
            score = data.get("score", 0)
            if email and score >= 20:   # score 0-100, 20+ = plausible
                return email.lower().strip()
        elif resp.status_code == 429:
            logger.warning("Hunter.io rate limit reached")
        elif resp.status_code == 401:
            logger.warning("Hunter.io: invalid API key")
    except Exception as e:
        logger.warning("Hunter.io call failed: %s", e)
    return ""


def _enrich_email(prospect: dict, hunter_key: str) -> dict:
    """Add a verified email to a prospect dict using Hunter.io if available."""
    existing = (prospect.get("email") or "").strip()
    # Keep existing valid email
    if existing and _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", existing):
        return prospect
    if hunter_key:
        domain = _extract_domain(prospect.get("website", ""))
        if domain:
            found = _hunter_find_email(prospect.get("name", ""), domain, hunter_key)
            if found:
                prospect = {**prospect, "email": found}
    return prospect


# ---------------------------------------------------------------------------
# Gemini fallback
# ---------------------------------------------------------------------------
def _call_gemini_fallback(filters: dict) -> list:
    """
    Use Gemini 2.0 Flash with Google Search grounding to find REAL companies
    and decision-makers matching the filters. Falls back to structured generation
    if the grounded call fails.
    """
    title = filters.get("title") or "CEO"
    country = filters.get("country") or ""
    industry = filters.get("industry") or ""
    size = filters.get("employee_count") or ""
    keyword = filters.get("keyword") or ""
    org_name = filters.get("organization_name") or ""

    # Build a natural-language search query for Google grounding
    parts = []
    if title:
        parts.append(f'"{title}"')
    if org_name:
        parts.append(f'site entreprise "{org_name}"')
    if industry:
        parts.append(industry)
    if country:
        parts.append(country)
    if keyword:
        parts.append(keyword)
    if size:
        parts.append(f"entreprise {size} employés")
    search_context = " ".join(parts) if parts else "startups B2B internationales"

    grounded_prompt = f"""Tu es un expert en prospection B2B. Recherche sur le web des VRAIES entreprises et VRAIS dirigeants correspondant à ces critères :

Poste recherché : {title or "décideur"}
Pays : {country or "international"}
Secteur : {industry or "tout secteur"}
Taille : {size or "toute taille"}
{f"Mot-clé : {keyword}" if keyword else ""}
{f"Entreprise : {org_name}" if org_name else ""}

Contexte de recherche : {search_context}

En utilisant ta recherche Google, trouve 10 vrais professionnels réels (pas inventés).
Pour chaque résultat :
1. Trouve le site officiel de l'entreprise (ex: https://stripe.com)
2. Cherche l'email de contact professionnel sur le site (page Contact, About, Team, LinkedIn)
3. Si tu trouves un email direct (ex: john@company.com) → utilise-le
4. Si tu trouves seulement le domaine → construis l'email au format prenom.nom@domaine.com
5. Si vraiment introuvable → format générique : contact@domaine.com

RÈGLE ABSOLUE pour l'email :
- NE JAMAIS laisser le champ email vide si tu as le site web
- Format : toujours en minuscules, jamais d'espaces
- Exemples valides : john.smith@stripe.com, contact@innovateai.com, ceo@techstartup.fr

Réponds UNIQUEMENT en JSON valide, sans commentaire ni markdown :
[
  {{
    "name": "Prénom Nom réel",
    "title": "Titre exact",
    "company": "Nom entreprise réelle",
    "country": "Pays",
    "email": "prenom.nom@domaine.com",
    "website": "https://site-officiel.com",
    "linkedin": "https://linkedin.com/in/profil-reel",
    "source": "ai_generated"
  }}
]
Génère exactement 10 objets avec des données les plus réelles possible."""

    # Try with Google Search grounding first
    client = get_client()
    if client:
        try:
            from google.genai import types as genai_types
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=grounded_prompt,
                config=genai_types.GenerateContentConfig(
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    temperature=0.2,
                ),
            )
            raw_text = (response.text or "").strip()
            # Strip markdown fences if present
            cleaned = raw_text.replace("```json", "").replace("```", "").strip()
            # Find the JSON array
            start = cleaned.find("[")
            end = cleaned.rfind("]") + 1
            if start != -1 and end > start:
                data = json.loads(cleaned[start:end])
                if isinstance(data, list) and len(data) > 0:
                    logger.info("Gemini grounded search returned %d results", len(data))
                    return data
        except Exception as e:
            logger.warning("Gemini grounded search failed, falling back to generation: %s", e)

    # Fallback: structured generation with strong variation constraints
    seed = random.randint(10000, 99999)
    fallback_prompt = f"""Tu es un expert en prospection B2B internationale. Graine : {seed}

Génère 10 profils B2B réalistes.
Critères : poste={title}, pays={country or "international"}, secteur={industry or "varié"}, taille={size or "varié"}
{f"Mot-clé : {keyword}" if keyword else ""}

RÈGLES :
1. 10 noms TOUS DIFFÉRENTS, cohérents avec le pays.
2. 10 entreprises TOUTES DIFFÉRENTES, noms crédibles (pas TechCorp, Acme, InnovateAI).
3. Emails : prenom.nom@domaine-entreprise.ext (ne pas inventer si incertain, laisser vide).
4. Sites web réalistes (pas exemple.com).
5. LinkedIn : https://linkedin.com/in/prenom-nom.
6. Si international : au moins 6 pays différents.

JSON uniquement, 10 objets :
[{{"name":"","title":"","company":"","country":"","email":"","website":"","linkedin":"","source":"ai_generated"}}]"""

    raw = generate_json_with_fallback(
        gemini_client=client,
        prompt=fallback_prompt,
        prefs={"ai_mode": "cloud"},
        cloud_model="gemini-2.0-flash",
    )
    results = []
    if isinstance(raw, list):
        results = raw
    elif isinstance(raw, dict):
        for v in raw.values():
            if isinstance(v, list):
                results = v
                break

    return results


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@prospection_bp.route('/api/v1/prospection/setup', methods=['POST', 'DELETE'])
def setup_apollo():
    """
    POST  /api/v1/prospection/setup  { "api_key": "xxx" } — validate & persist the key
    DELETE /api/v1/prospection/setup                       — remove the key
    """
    if request.method == 'DELETE':
        try:
            settings = get_workspace_settings(1)
            settings.pop('apolloApiKey', None)
            update_workspace_settings(1, settings)
            _invalidate_apollo_key_cache()
            logger.info("Apollo API key removed from workspace settings")
        except Exception as e:
            logger.error("Failed to remove Apollo key: %s", e)
            return jsonify({"error": "Impossible de supprimer la clé"}), 500
        return jsonify({"success": True})

    # POST — validate then persist
    body = request.get_json(silent=True) or {}
    api_key = (body.get('api_key') or '').strip()

    if not api_key:
        return jsonify({"error": "Clé API requise"}), 400

    # Light format check — full validation happens on first search
    if len(api_key) < 10:
        return jsonify({"error": "Clé API trop courte — vérifie que tu as copié la clé complète."}), 400

    # Persist key in workspace settings (workspace_id=1)
    try:
        settings = get_workspace_settings(1)
        settings['apolloApiKey'] = api_key
        update_workspace_settings(1, settings)
        _invalidate_apollo_key_cache()
        global _apollo_available, _apollo_disabled_at
        _apollo_available = True
        _apollo_disabled_at = 0.0
        logger.info("Apollo API key saved to workspace settings")
    except Exception as e:
        logger.error("Failed to persist Apollo key: %s", e)
        return jsonify({"error": "Impossible de sauvegarder la clé"}), 500

    return jsonify({"success": True, "message": "Clé Apollo.io enregistrée"})


@prospection_bp.route('/api/v1/prospection/search', methods=['POST'])
def search_prospects():
    """
    POST /api/v1/prospection/search
    Body: { title, country, industry, employee_count, keyword, organization_name, page }
    Returns: { results: [...], source: "apollo"|"ai_generated", credits_remaining: int|null,
               total_entries: int, page: int }
    """
    body = request.get_json(silent=True) or {}
    filters = {
        "title":             body.get("title", ""),
        "country":           body.get("country", ""),
        "industry":          body.get("industry", ""),
        "employee_count":    body.get("employee_count", ""),
        "keyword":           body.get("keyword", ""),
        "organization_name": body.get("organization_name", ""),
    }
    page = max(1, int(body.get("page", 1)))

    # Check cache first
    ck = _cache_key(filters, page)
    cached = _cache_get(ck)
    if cached:
        logger.info("Returning cached prospection results (page=%d)", page)
        return jsonify(cached)

    api_key = _get_apollo_key()
    use_apollo = bool(api_key) and _is_apollo_available()

    apollo_warning = None
    if use_apollo:
        try:
            data = _call_apollo(filters, api_key, page=page)
            logger.info(
                "Apollo search OK — %d results (credits_remaining=%s, total=%s)",
                len(data["results"]), data["credits_remaining"], data["total_entries"]
            )
            response = {
                "results": _add_fit_scores(data["results"]),
                "source": "apollo",
                "credits_remaining": data["credits_remaining"],
                "total_entries": data["total_entries"],
                "page": page,
            }
            _cache_set(ck, response)
            return jsonify(response)
        except ApolloCreditsError as e:
            _disable_apollo(str(e))
            apollo_warning = "credits_exhausted"
            logger.info("Falling back to Gemini after Apollo credits error")
        except Exception as e:
            status_code = getattr(getattr(e, 'response', None), 'status_code', None)
            if status_code == 403:
                apollo_warning = "plan_required"
                logger.warning("Apollo 403 — paid plan required for people search")
            else:
                apollo_warning = f"apollo_error_{status_code or 'unknown'}"
            logger.error("Apollo call failed (non-credits error): %s", e)
            logger.info("Falling back to Gemini after Apollo error")
    elif api_key and not _is_apollo_available():
        apollo_warning = "credits_exhausted"

    # --- Gemini fallback (no pagination — always returns 10) ---
    try:
        results = _call_gemini_fallback(filters)
        logger.info("Gemini fallback produced %d results", len(results))

        # Enrich emails via Hunter.io if configured
        hunter_key = _get_hunter_key()
        if hunter_key:
            enriched = []
            for p in results:
                enriched.append(_enrich_email(p, hunter_key))
                time.sleep(0.3)   # gentle rate-limiting
            results = enriched
            logger.info("Hunter.io email enrichment applied to %d prospects", len(results))

        response = {
            "results": _add_fit_scores(results),
            "source": "ai_generated",
            "credits_remaining": None,
            "total_entries": len(results),
            "page": 1,
            "apollo_warning": apollo_warning,
        }
        _cache_set(ck, response)
        return jsonify(response)
    except Exception as e:
        logger.error("Gemini fallback also failed: %s", e)
        return jsonify({"error": "Service de prospection temporairement indisponible."}), 503


# ---------------------------------------------------------------------------
# Fit score
# ---------------------------------------------------------------------------
_HIGH_FIT_SECTORS = {
    'saas', 'logiciel', 'agence', 'digital', 'startup', 'tech', 'e-commerce',
    'retail', 'fintech', 'edtech', 'formation', 'consulting', 'services',
    'luxe', 'mode', 'immobilier', 'communication', 'marketing',
}
_FR_COUNTRIES = {'france', 'belgique', 'suisse', 'canada', 'luxembourg', 'maroc', 'tunisie'}


def _compute_fit_score(prospect: dict) -> int:
    """
    Heuristic fit score 0-100 indicating how relevant a prospect is for Marion
    (freelance webdesigner).
    """
    score = 30  # baseline

    industry = (prospect.get("industry") or prospect.get("company") or "").lower()
    if any(kw in industry for kw in _HIGH_FIT_SECTORS):
        score += 20

    country = (prospect.get("country") or "").lower()
    if country in _FR_COUNTRIES:
        score += 15

    if prospect.get("email"):
        score += 10

    if prospect.get("website"):
        score += 10

    if prospect.get("linkedin"):
        score += 5

    title = (prospect.get("title") or "").lower()
    if any(kw in title for kw in ('ceo', 'founder', 'directeur', 'director', 'head', 'vp', 'cmo', 'cdo', 'responsable')):
        score += 10

    return min(score, 100)


def _add_fit_scores(prospects: list) -> list:
    for p in prospects:
        p['fit_score'] = _compute_fit_score(p)
    return prospects


# ---------------------------------------------------------------------------
# Email generation endpoint
# ---------------------------------------------------------------------------
@prospection_bp.route('/api/v1/prospection/generate-email', methods=['POST'])
def generate_prospect_email():
    """
    POST /api/v1/prospection/generate-email
    Body: { name, title, company, country, website, industry }
    Returns: { subject, body }
    """
    body = request.get_json(silent=True) or {}
    name = body.get("name", "")
    title = body.get("title", "")
    company = body.get("company", "")
    country = body.get("country", "")
    website = body.get("website", "")
    industry = body.get("industry", "")

    context_parts = []
    if website:
        context_parts.append(f"Site web : {website}")
    if industry:
        context_parts.append(f"Secteur : {industry}")
    if country:
        context_parts.append(f"Pays : {country}")
    context = "\n".join(context_parts)

    prompt = f"""Tu es Marion, webdesigner freelance spécialisée en création de sites web, identité visuelle et expérience utilisateur.
Rédige un email de prospection court et personnalisé pour :
- Nom : {name or "ce contact"}
- Poste : {title or "décideur"}
- Entreprise : {company or "l'entreprise"}
{context}

L'email doit :
1. Commencer par une accroche personnalisée mentionnant un détail spécifique à leur activité ou secteur (pas générique)
2. Présenter ta valeur en une seule phrase percutante
3. Proposer un appel de 15 minutes sans pression
4. Rester court : 5 à 7 lignes maximum
5. Ton professionnel mais humain et direct — pas de jargon, pas de formules creuses

Réponds en JSON valide uniquement :
{{"subject": "Sujet de l'email (court, accrocheur)", "body": "Corps de l'email complet avec salutation et signature Marion"}}"""

    client = get_client()
    try:
        result = generate_json_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs={"ai_mode": "cloud"},
            cloud_model="gemini-2.0-flash",
        )
        if isinstance(result, dict) and "subject" in result and "body" in result:
            return jsonify(result)
        return jsonify({"error": "Réponse inattendue du modèle"}), 500
    except Exception as e:
        logger.error("generate_prospect_email failed: %s", e)
        return jsonify({"error": "Impossible de générer l'email"}), 500


# ---------------------------------------------------------------------------
# Website analysis endpoint
# ---------------------------------------------------------------------------
@prospection_bp.route('/api/v1/prospection/analyze-website', methods=['POST'])
def analyze_prospect_website():
    """
    POST /api/v1/prospection/analyze-website
    Body: { website, company, industry }
    Returns: { what, need, angle }
    """
    body = request.get_json(silent=True) or {}
    website = (body.get("website") or "").strip()
    company = body.get("company") or "cette entreprise"
    industry = body.get("industry") or ""

    if not website:
        return jsonify({"error": "URL du site requise"}), 400

    prompt = f"""Recherche et visite le site {website} (entreprise : {company}{f', secteur : {industry}' if industry else ''}).

En analysant le site, réponds en 3 phrases courtes et concrètes :
1. CE QUE FAIT L'ENTREPRISE : Décris leur activité principale en une phrase simple.
2. LEUR BESOIN WEB/DESIGN : Identifie ce dont ils pourraient avoir besoin côté design, site web ou identité visuelle (manques, opportunités, améliorations potentielles).
3. ANGLE D'APPROCHE : Quel serait le meilleur angle pour qu'une webdesigner freelance les contacte ? (ex: refonte site, identité visuelle, UX, landing page campagne, etc.)

Réponds en JSON uniquement :
{{"what": "...", "need": "...", "angle": "..."}}"""

    client = get_client()
    try:
        from google.genai import types as genai_types
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                temperature=0.3,
            ),
        )
        raw = (response.text or "").strip().replace("```json", "").replace("```", "").strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start != -1 and end > start:
            result = json.loads(raw[start:end])
            if all(k in result for k in ("what", "need", "angle")):
                return jsonify(result)
    except Exception as e:
        logger.warning("Grounded website analysis failed, trying plain Gemini: %s", e)

    # Fallback: plain generation without grounding
    try:
        result = generate_json_with_fallback(
            gemini_client=client,
            prompt=prompt,
            prefs={"ai_mode": "cloud"},
            cloud_model="gemini-2.0-flash",
        )
        if isinstance(result, dict) and "what" in result:
            return jsonify(result)
    except Exception as e:
        logger.error("analyze_prospect_website failed: %s", e)

    return jsonify({"error": "Impossible d'analyser le site"}), 500


@prospection_bp.route('/api/v1/prospection/hunter', methods=['POST', 'DELETE'])
def setup_hunter():
    """
    POST  { "api_key": "xxx" } — save Hunter.io key
    DELETE                     — remove Hunter.io key
    """
    if request.method == 'DELETE':
        try:
            settings = get_workspace_settings(1)
            settings.pop('hunterApiKey', None)
            update_workspace_settings(1, settings)
            _invalidate_hunter_key_cache()
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        return jsonify({"success": True})

    body = request.get_json(silent=True) or {}
    api_key = (body.get('api_key') or '').strip()
    if len(api_key) < 10:
        return jsonify({"error": "Clé trop courte"}), 400
    try:
        settings = get_workspace_settings(1)
        settings['hunterApiKey'] = api_key
        update_workspace_settings(1, settings)
        _invalidate_hunter_key_cache()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"success": True, "message": "Clé Hunter.io enregistrée"})


@prospection_bp.route('/api/v1/prospection/status', methods=['GET'])
def prospection_status():
    """Returns Apollo availability status and config."""
    api_key = _get_apollo_key()
    available = _is_apollo_available()
    return jsonify({
        "apollo_configured": bool(api_key),
        "apollo_available": available,
        "apollo_retry_in_seconds": max(0, int(APOLLO_RETRY_AFTER_SECONDS - (time.time() - _apollo_disabled_at))) if not available else 0,
        "key_source": "db" if _apollo_key_cache else "env",
        "hunter_configured": bool(_get_hunter_key()),
    })
