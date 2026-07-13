# Eonora Tech OS — Notes de release v2.4.7

Descriptif complet des changements livrés dans cette version.

---

## Meeting Copilot (réunions assistées)

### Parcours en 3 phases
- **Pre-call** : préparation avant la réunion (objectif, consentement, politique de rétention).
- **In-call** : enregistrement avec transcription en direct, visualisation audio, et coaching en temps réel (suggestions de relances, points d’attention).
- **Post-call** : analyse automatique du compte-rendu, tâches extraites, brouillon de suivi, et export PDF.

### Interface
- **StatusRail** : indicateur visuel des étapes (Pre-call → In-call → Post-call).
- **TranscriptTimeline** : affichage du transcript par segments pendant et après la réunion.
- **CoachingCard** : cartes de coaching (cues) avec priorité (basse / moyenne / haute) et justification.
- **ActionTable** : tableau des actions/tâches issues du rapport, éditable (titre, responsable, échéance, priorité), avec cases à cocher pour sélection.

### Backend meeting
- **Analyse** (`/api/v1/meeting/analyze`) : schéma de rapport strict, ranking des tâches, stratégie de fallback sur le transcript si l’IA renvoie des champs manquants.
- **Coaching** (`/api/v1/meeting/coach`) : suggestions en temps réel à partir du transcript roulant, avec taux de fallback suivi.
- **Politique** (`/api/v1/meeting/policy`) : GET/POST pour lire et mettre à jour la politique de réunions (rétention en jours, exigence de consentement).
- **Audit** : événements lifecycle (démarrage, arrêt, partage, sauvegarde) et export enregistrés pour traçabilité.

### Persistance et rechargement
- Les rapports de réunion sont sauvegardés et rechargés correctement dans les flux backend (scan/save), avec rehydration côté client (historique, détail).

---

## Export PDF des comptes-rendus

- **Rapport PDF** : génération de PDF à partir du compte-rendu (résumé, points clés, décisions, prochaines étapes, risques, objections, tableau d’actions).
- **Variantes** : version **interne** (complète) et version **client** (adaptée pour envoi au client), avec ligne de conformité (consentement, rétention) sur la version interne.
- **Utils** : `utils/meetingReportPdf.ts` (génération HTML du rapport puis export), `utils/pdfExport.ts` (impression HTML en PDF via fenêtre d’impression, réutilisation possible ailleurs).

---

## Conformité et confidentialité (réunions)

- **Consentement** : case à cocher obligatoire avant démarrage d’enregistrement si la politique l’exige ; stockage de `consentAccepted` dans le rapport.
- **Rétention** : durée de rétention configurable (1–365 jours), stockée dans la politique et dans chaque rapport ; application de la règle (ex. pas de conservation longue du transcriptExcerpt si rétention courte).
- **Redaction PII** : redaction des données personnelles (PII) dans les transcripts avant envoi à l’IA (`_redact_pii` dans `api/ai_bp.py`).
- **Audit** : écriture d’événements pour mise à jour de politique, analyse, coaching, export PDF et étapes du cycle de vie de la réunion (démarrage, arrêt, partage, sauvegarde).

---

## Observabilité et santé

- **Métriques meeting** : compteurs pour analyse/coach (succès, échecs, fallback transcription) exposés dans `/api/v1/health`.
- **SLO** : indicateurs `meeting_slo` (taux d’échec analyse/coach, taux de fallback transcription) pour surveillance.
- **Health** : endpoint `/api/v1/health` enrichi (version, uptime, dépendances IA, SLO meeting).
- **Correlation IDs** : traçabilité des requêtes meeting (logs backend) pour le débogage.

---

## Autres évolutions

- **Dashboard** : ajustements d’affichage ou de liens (pages/Dashboard.tsx).
- **ClientView** : intégration du mode réunion et du parcours Meeting Copilot.
- **BrandCenter, FinanceDashboard, InvoiceBuilder, LogoLab** : améliorations et corrections diverses.
- **Services** : `services/queries.ts` et `services/meeting_transcription_service.py` (support transcription/meeting) ; `services/gemini_service.py` mis à jour pour l’IA meeting.
- **Base de données** : évolution `database/db.py` (tables ou champs pour paramètres, audit, politique).
- **Types** : `types.ts` étendu (MeetingReport, MeetingReportTask, consentement, rétention, etc.).
- **API** : `api/ai_bp.py` (routes meeting, policy, audit, redaction, validation rapport), `api/projects_bp.py`, `api/v1/health.py` ; `docs/api/openapi.yaml` mis à jour (version 2.4.7).
- **CI** : `.github/workflows/ci.yml` mis à jour si applicable.
- **Tests** : `tests/test_meeting_assistant.py` (analyse, consentement, politique) ; tests frontend existants conservés.
- **Build / PWA** : `vite.config.ts`, `index.html`, `public/manifest.json`, `public/offline.html`, `public/sw.js` et build `.dist/` régénéré pour la v2.4.7.
- **i18n** : `translations/i18n.ts` mis à jour si de nouvelles chaînes ont été ajoutées.
- **Version** : 2.4.7 dans `config.py`, `App.tsx`, `package.json`, `package-lock.json`, `docs/api/openapi.yaml`, `components/WhatsNew.tsx`.

---

## Fichiers principaux modifiés ou ajoutés

| Domaine        | Fichiers |
|----------------|----------|
| Meeting UI     | `components/MeetingMode.tsx`, `components/meeting/StatusRail.tsx`, `components/meeting/CoachingCard.tsx`, `components/meeting/TranscriptTimeline.tsx`, `components/meeting/ActionTable.tsx` |
| PDF / export   | `utils/meetingReportPdf.ts`, `utils/pdfExport.ts` |
| API meeting    | `api/ai_bp.py` (analyze, coach, policy, audit, redaction) |
| Services       | `services/meeting_transcription_service.py`, `services/queries.ts`, `services/gemini_service.py` |
| Données        | `database/db.py`, `types.ts` |
| Santé / SLO    | `api/v1/health.py` |
| Autres pages   | `pages/Dashboard.tsx`, `components/ClientView.tsx`, `components/BrandCenter.tsx`, `components/FinanceDashboard.tsx`, `components/InvoiceBuilder.tsx`, `components/LogoLab.tsx`, `components/WhatsNew.tsx` |
| Config / build | `config.py`, `App.tsx`, `package.json`, `package-lock.json`, `vite.config.ts`, `docs/api/openapi.yaml` |
| Tests          | `tests/test_meeting_assistant.py` |

---

*Release créée le 13 mars 2026 — v2.4.7*
