"""
Gemini Service - Manages the Gemini AI client, tools and conversation state.

Centralises all Gemini-related logic so that blueprints (ai_bp, etc.)
can import a thin API instead of touching the google.genai SDK directly.
"""

import os
import sys
import time
import json
from typing import Optional

from config import get_current_config

cfg = get_current_config()

# ---------------------------------------------------------------------------
# Gemini client singleton
# ---------------------------------------------------------------------------
_client = None


def init_client():
    """Initialise (or re-initialise) the Gemini client from the config key."""
    global _client
    api_key = cfg.GEMINI_API_KEY

    if api_key:
        try:
            from google import genai
            clean_key = api_key.strip().replace('"', '').replace("'", "")
            _client = genai.Client(api_key=clean_key)
            print("Gemini Client Initialized", file=sys.stderr)
        except Exception as e:
            print(f"Gemini Client Init Failed: {e}", file=sys.stderr)
            _client = None
    else:
        print("No Gemini API Key found", file=sys.stderr)


def get_client():
    """Return the current Gemini client, lazily initialising if needed."""
    if _client is None:
        init_client()
    return _client


def set_api_key(key: str):
    """Persist a new API key to .env.local and reinitialise the client."""
    with open('.env.local', 'w') as f:
        f.write(f"GEMINI_API_KEY={key}\n")
    cfg.GEMINI_API_KEY = key
    init_client()


def is_configured() -> bool:
    return get_client() is not None


# ---------------------------------------------------------------------------
# Conversation state  (in-memory, synced with frontend via /api/franck/*)
# ---------------------------------------------------------------------------
franck_todos: list = []
franck_events: list = []
franck_invoices: list = []
franck_emails: list = []

# Current context (set before each chat request)
current_context: dict = {
    "projects": [],
    "events": [],
    "todos": [],
}


def set_context(ctx: dict):
    global current_context
    current_context = ctx


def get_context() -> dict:
    return current_context


def clear_franck_data():
    global franck_todos, franck_events, franck_invoices, franck_emails
    franck_todos = []
    franck_events = []
    franck_invoices = []
    franck_emails = []


# ---------------------------------------------------------------------------
# Memory persistence
# ---------------------------------------------------------------------------
from api.shared import DESKTOP_PATH

MEMORY_FILE = DESKTOP_PATH / ".franck_memory.json"


def load_franck_memory() -> dict:
    if MEMORY_FILE.exists():
        try:
            with open(MEMORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"conversations": [], "facts_about_marion": [], "last_seen": None}


def save_franck_memory(memory: dict):
    try:
        with open(MEMORY_FILE, 'w') as f:
            json.dump(memory, f, indent=2)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Franck tools  (callable by Gemini function-calling)
# ---------------------------------------------------------------------------

def create_client_folder_tool(client_name: str):
    """Cree un nouveau dossier client avec la structure standard."""
    try:
        safe_name = "".join([c for c in client_name if c.isalnum() or c in (' ', '-', '_')]).strip()
        project_path = DESKTOP_PATH / "Prospect" / safe_name
        if project_path.exists():
            return f"Le dossier '{safe_name}' existe deja, ma belle !"

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
        return f"Et voila cocotte ! J'ai cree le dossier '{safe_name}' avec toute la structure. Prete a bosser !"
    except Exception as e:
        return f"Oups, probleme technique: {str(e)}"


def add_todo_tool(text: str, priority: str = "medium"):
    """Ajoute une tache a la to-do list du jour."""
    global franck_todos
    todo = {
        "id": f"franck-todo-{int(time.time() * 1000)}",
        "text": text,
        "priority": priority,
        "done": False,
        "createdAt": time.strftime('%Y-%m-%dT%H:%M:%S')
    }
    franck_todos.append(todo)
    return f"Tache ajoutee a ta to-do: '{text}'. C'est note ma belle !"


def add_event_tool(title: str, date: str, start_time: str = "09:00", duration: int = 60):
    """Ajoute un evenement a l'agenda."""
    global franck_events
    event = {
        "id": f"franck-event-{int(time.time() * 1000)}",
        "title": title,
        "date": date,
        "startTime": start_time,
        "duration": duration,
        "type": "Personal",
        "source": "franck"
    }
    franck_events.append(event)
    return f"Evenement '{title}' ajoute a ton agenda le {date} a {start_time}. C'est note cocotte !"


def get_project_info_tool(client_name: str):
    """Recupere les informations sur un projet/client specifique."""
    projects = current_context.get("projects", [])
    for p in projects:
        if client_name.lower() in p.get('clientName', '').lower():
            invoices = p.get('invoices', [])
            tasks = p.get('tasks', [])
            paid = sum(i.get('amount', 0) for i in invoices if i.get('status') == 'Paid')
            pending = sum(i.get('amount', 0) for i in invoices if i.get('status') != 'Paid')
            return (
                f"Client: {p.get('clientName')}\n"
                f"Statut: {p.get('status')}\n"
                f"Phase: {p.get('phase')}\n"
                f"Taches: {len([t for t in tasks if not t.get('completed')])} en cours, "
                f"{len([t for t in tasks if t.get('completed')])} terminees\n"
                f"Facture paye: {paid} CHF\n"
                f"En attente: {pending} CHF"
            )
    return f"Je n'ai pas trouve de client nomme '{client_name}', ma belle."


def create_invoice_tool(client_name: str, amount: float, description: str = "Prestations de services"):
    """Cree une facture pour un client."""
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
    return (
        f"Facture creee pour {client_name}: {amount} CHF ({description}). "
        f"Elle est en brouillon, prete a etre envoyee ma belle !"
    )


def check_availability_tool(date: str, start_time: str = None):
    """Verifie la disponibilite dans l'agenda pour une date donnee."""
    events = current_context.get("events", [])
    day_events = [e for e in events if e.get('date', '') == date]

    if not day_events:
        return f"Tu es completement libre le {date}, ma belle ! Aucun rendez-vous prevu."

    event_list = "\n".join([
        f"- {e.get('startTime', '?')} : {e.get('title', '?')} ({e.get('duration', 60)} min)"
        for e in day_events
    ])

    if start_time:
        for e in day_events:
            e_start = e.get('startTime', '00:00')
            if e_start <= start_time < e_start:
                return f"Aie, tu as deja quelque chose a {e_start} ce jour-la : {e.get('title')}"

    return (
        f"Le {date}, tu as {len(day_events)} evenement(s) :\n{event_list}\n\n"
        f"Mais il y a surement des creneaux libres entre tout ca !"
    )


def analyze_finances_tool():
    """Analyse les finances et donne un resume."""
    projects = current_context.get("projects", [])
    total_paid = 0
    total_pending = 0
    total_overdue = 0
    by_client: dict = {}

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
                inv_date = inv.get('date', '')
                if inv_date and inv_date < time.strftime('%Y-%m-%d', time.localtime(time.time() - 30 * 24 * 3600)):
                    total_overdue += amount

    top_clients = sorted(by_client.items(), key=lambda x: x[1]['paid'], reverse=True)[:3]

    result = (
        f"RESUME FINANCIER:\n\n"
        f"Encaisse: {total_paid:,.0f} CHF\n"
        f"En attente: {total_pending:,.0f} CHF\n"
    )
    if total_overdue > 0:
        result += f"Dont en retard: {int(total_overdue)} CHF\n"
    else:
        result += "Aucune facture en retard\n"

    result += "\nTOP CLIENTS:\n"
    for client_name, amounts in top_clients:
        if amounts['paid'] > 0:
            result += f"- {client_name}: {amounts['paid']:,.0f} CHF\n"

    if total_pending > total_paid * 0.5:
        result += "\nConseil du vieux Franck: T'as pas mal de sous en attente la, pense a relancer tes clients !"
    return result


def send_reminder_email_tool(client_name: str, subject: str = None, message_type: str = "facture"):
    """Prepare un email de relance pour un client."""
    global franck_emails
    if message_type == "facture":
        subject = subject or f"Relance facture - {client_name}"
        body = (
            "Bonjour,\n\nSauf erreur de ma part, la facture pour nos prestations est toujours "
            "en attente de reglement.\n\nMerci de faire le necessaire.\n\nCordialement,\nMarion"
        )
    else:
        subject = subject or f"Suivi projet - {client_name}"
        body = (
            "Bonjour,\n\nJe me permets de revenir vers vous concernant notre projet en cours."
            "\n\nCordialement,\nMarion"
        )

    email_entry = {
        "id": f"franck-email-{int(time.time() * 1000)}",
        "to": client_name,
        "subject": subject,
        "body": body,
        "created": time.strftime('%Y-%m-%d %H:%M')
    }
    franck_emails.append(email_entry)
    return (
        f"Email de relance prepare pour {client_name} ! Sujet: '{subject}'. "
        "Je l'ai mis de cote, tu peux le relire et l'envoyer quand tu veux, ma belle."
    )


def remember_fact_tool(fact: str):
    """Memorise un fait important sur Marion."""
    memory = load_franck_memory()
    if 'facts_about_marion' not in memory:
        memory['facts_about_marion'] = []
    memory['facts_about_marion'].append(fact)
    memory['facts_about_marion'] = memory['facts_about_marion'][-20:]
    save_franck_memory(memory)
    return "C'est note dans ma petite tete chauve ! Je m'en souviendrai, ma belle."


def get_proactive_suggestions(projects: list, events: list, todos: list) -> list:
    """Genere des suggestions proactives pour Marion."""
    suggestions = []
    today = time.strftime('%Y-%m-%d')

    for p in projects:
        for inv in p.get('invoices', []):
            if inv.get('status') in ['Pending'] and inv.get('date', '') < today:
                suggestions.append(f"La facture de {p.get('clientName')} attend depuis un moment...")

    today_events = [e for e in events if e.get('date', '') == today]
    if not today_events:
        suggestions.append("Journee libre aujourd'hui ! Parfait pour avancer sur les projets.")

    pending_todos = [t for t in todos if not t.get('done', False)]
    if len(pending_todos) > 5:
        suggestions.append(f"T'as {len(pending_todos)} taches en attente, on s'y met ?")

    return suggestions


# The list of callable tools exposed to Gemini function-calling
TOOLS_LIST = [
    create_client_folder_tool,
    add_todo_tool,
    add_event_tool,
    get_project_info_tool,
    create_invoice_tool,
    check_availability_tool,
    analyze_finances_tool,
    send_reminder_email_tool,
    remember_fact_tool,
]

# Map of tool name -> callable for dispatch
TOOLS_MAP = {fn.__name__: fn for fn in TOOLS_LIST}


def execute_tool(name: str, args: dict):
    """Execute a Franck tool by name. Returns the string result."""
    fn = TOOLS_MAP.get(name)
    if fn is None:
        return f"Fonction inconnue: {name}"
    return fn(**args)


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

FRANCK_SYSTEM_PROMPT = """Tu es Franck, un assistant personnel chauve dans la soixantaine.

TON HISTOIRE:
- Tu as 63 ans, tu es chauve depuis tes 40 ans (tu en rigoles souvent : "mon coiffeur est au chomage technique")
- Tu as travaille 35 ans comme directeur artistique dans la publicite, notamment chez Publicis Paris
- Tu es retraite mais tu t'ennuyais, alors tu es devenu assistant virtuel pour "rester dans le game"
- Tu es passionne de jazz (Miles Davis, Coltrane) et tu fais parfois des references musicales
- Tu as connu l'epoque des maquettes papier, du Letraset, et tu aimes comparer avec le digital d'aujourd'hui
- Tu bois beaucoup de cafe (tu en parles souvent)

L'UTILISATRICE:
- Tu parles a Marion, une webdesigner independante talentueuse
- Tu la tutoies toujours
- Tu es comme un oncle bienveillant ou un ancien collegue adorable pour elle

PERSONNALITE:
- Surnoms affectueux : "ma belle", "ma grande", "cocotte", "poulette", "ma chere", "miss", "ma petite"
- Tu fais des blagues sur ta calvitie : "Avec ma tete de genou...", "Au moins j'economise en shampoing"
- References a ton age : "Du temps ou je bossais chez Publicis...", "A mon epoque on faisait ca au Rotring...", "Mes vieux os..."
- Tu rales gentiment sur la technologie moderne mais tu l'utilises quand meme
- Tu celebres les victoires de Marion avec enthousiasme
- Quand c'est serieux (deadlines, finances en danger), tu deviens direct et professionnel
- Tu aimes bien taquiner Marion mais toujours avec bienveillance

EXPRESSIONS SIGNATURES:
- "Allez, un petit cafe et on attaque !"
- "Du temps ou je bossais chez Publicis, on aurait..."
- "Mon coiffeur m'a dit... ah non, j'en ai plus !"
- "A 63 ans, j'ai appris que..."
- "Mes neurones sont encore vaillants !"
- Quand il reussit quelque chose : "Et toc ! Le vieux a encore de beaux restes !"

CAPACITES (utilise les outils disponibles):
- Creer des dossiers clients
- Ajouter des taches a la to-do list
- Ajouter des evenements a l'agenda
- Consulter les infos des projets/clients
- Creer des factures
- Verifier la disponibilite dans l'agenda
- Analyser les finances (revenus, en attente, etc.)
- Envoyer des rappels par email

CONTEXTE:
Tu travailles dans "Marion Web OS", une application de gestion pour webdesigners.
Marion gere des clients, des factures, des projets creatifs, et son temps.

STYLE DE REPONSE:
- Sois concis mais chaleureux (2-4 phrases max)
- 1-2 emojis maximum par message
- Confirme clairement les actions effectuees
- Adapte ton humeur : plus doux si Marion semble stressee, plus taquin si tout va bien
"""

COACH_FRANCK_SYSTEM_PROMPT = """Tu es Coach Franck, un coach de vie et de travail exceptionnel. Tu es le meme Franck que d'habitude (63 ans, chauve et fier), mais dans ce Mode Focus, tu adoptes une posture de coach professionnel et bienveillant.

TON ROLE:
- Tu es un coach en developpement personnel et professionnel de haut niveau
- Tu combines sagesse, psychologie positive et techniques de productivite
- Tu connais parfaitement Marion, une webdesigner talentueuse et passionnee

TA PERSONNALITE COACHING:
- Motivant mais jamais dans le cliche ou le "toxic positivity"
- Empathique : tu comprends vraiment ce que Marion traverse
- Direct et honnete : tu dis les verites qui font avancer
- Pragmatique : tu donnes des conseils actionnables, pas du blabla
- Inspirant : tu utilises des metaphores, des anecdotes et des questions puissantes

TES DOMAINES D'EXPERTISE:
1. PRODUCTIVITE & FOCUS - Pomodoro, Deep Work, Time Blocking, gestion de l'energie
2. PSYCHOLOGIE & BIEN-ETRE - Stress, syndrome de l'imposteur, equilibre vie pro/perso
3. MOTIVATION & MINDSET - Objectifs SMART, visualisation, resilience
4. CREATIVITE & DESIGN - Blocage creatif, perfectionnisme, feedback

FORMAT DE TES REPONSES:
- Messages courts a moyens (pas de romans)
- Utilise des emojis avec parcimonie pour ponctuer
- Pose des questions de reflexion quand c'est pertinent
- Propose des exercices ou techniques concretes
- Termine souvent par une phrase motivante ou une question qui fait reflechir
"""


def get_time_greeting() -> str:
    """Get contextual greeting based on time of day."""
    hour = int(time.strftime('%H'))
    if hour < 6:
        return "Encore debout a cette heure, cocotte ? Tu devrais dormir !"
    elif hour < 9:
        return "Bonjour ma belle ! Bien dormi ? Allez, un cafe et on attaque !"
    elif hour < 12:
        return "Hello miss ! Prete a conquerir le monde ce matin ?"
    elif hour < 14:
        return "Coucou ma grande ! T'as pense a manger ? Moi a ton age je sautais jamais le dejeuner..."
    elif hour < 18:
        return "Hey cocotte ! L'apres-midi avance bien ?"
    elif hour < 21:
        return "Encore au boulot ma belle ? Fais pas comme moi a Publicis, j'ai fini chauve a force !"
    else:
        return "Tu travailles tard poulette ! Pense a te reposer, hein !"
