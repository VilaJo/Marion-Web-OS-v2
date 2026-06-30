# Release v2.7.0 — "Stable Marion" (Facturation CH + Santé financière)

Date : 30 juin 2026  
Thème : **Version stable pour installation sur nouveau Mac** — facturation aux standards suisses et agenda Google Calendar.

---

## Pourquoi cette release

Release ciblée pour Marion (nouveau MacBook Air M5) : facturation professionnelle conforme Suisse, santé financière v2, et agenda Google Calendar opérationnel. Build frontend inclus (`.dist/`) — pas besoin de `npm run dev`.

---

## Facturation — standards suisses

- **QR-bill v2.0** : IBAN / QR-IBAN, référence QRR (27 chiffres) ou SCOR (RF ISO 11649), validation backend stricte
- **TVA multi-taux** : 8.1 % / 3.8 % / 2.6 % / 0 % / exonéré par ligne, récap HT/TVA/TTC
- **Numérotation séquentielle** : `F{YYYY}-{NNNN}` atomique côté serveur (`/api/v1/invoices/next-number`)
- **Mentions légales** : IDE/UID et n° TVA via Paramètres → Agence
- **Cycle de vie** : brouillon supprimable, factures émises archivées (Voided/Archived) — conservation conforme
- **Notes de crédit** liées à la facture parente
- **Factures récurrentes** (mensuel / trimestriel / annuel) + tick automatique à l'ouverture
- **Relances 3 niveaux** avec frais paramétrables et journal d'audit
- **Multi-devise** : taux CHF figé à l'émission (`fxRateChf`)
- **Historique** : drawer timeline des actions sur chaque facture
- **Fix récépissé QR** : IBAN sur une seule ligne (spec SIX)

## Santé financière v2

- DSO (délai moyen de paiement)
- Ratio impayés
- Prévisionnel 12 mois (récurrentes + moyenne mobile)
- TVA à reverser par trimestre
- Alertes factures en retard
- Carte conformité (IDE, TVA, IBAN, numérotation)

## UI

- Barre d'outils **rétractable** (chevron en haut à droite sur desktop)

## Agenda (inchangé côté code, config requise)

- Sync Google Calendar via OAuth
- Voir `docs/INSTALL_MARION.md` pour la configuration Google (test users)

---

## Installation (Marion)

1. Télécharger la release **v2.7.0** ou le ZIP `main` depuis GitHub
2. Double-clic **`INSTALLER.command`**
3. Copier le fichier **`.env`** fourni par Johan (ne pas le publier sur GitHub)
4. Lancer **`Marion Web OS.app`** sur le Bureau
5. Paramètres → Connecter Google Calendar + renseigner IDE/TVA/IBAN

Guide détaillé : [`docs/INSTALL_MARION.md`](./INSTALL_MARION.md)

---

## Vérifications avant release

- [x] `npm run build` OK
- [x] `pytest tests/` — 104 passed
- [x] Frontend build servi depuis `.dist/`

---

## Précédent / Suivant

- Précédent : v2.6.4 (local, non publié)
- Suivant : v2.7.x (correctifs mineurs)
