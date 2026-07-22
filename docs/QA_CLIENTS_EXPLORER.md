# Checklist QA — Explorateur Clients & nav allégée (v2.11.0)

Date session : _______________
Machine Marion : _______________
Build / commit : _______________
Testeur(s) : Marion □  Johan □

Légende : **P** = Pass · **F** = Fail · **N/A** = non applicable

---

## P0 — Bloquants (obligatoires pour GO)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 1 | **Ouvrir l'app** → l'arborescence de dossiers (Tous / En cours / Maintenance / Association / Prospect / Archivé) est visible à gauche de la page Clients | □ | □ | □ | |
| 2 | **Cliquer « En cours »** dans l'arborescence → le tableau à droite ne montre que les clients « En cours », le nombre dans le badge correspond | □ | □ | □ | |
| 3 | **Tri deadline** : cliquer l'en-tête « Deadline » → les lignes se trient par échéance croissante, un second clic inverse l'ordre | □ | □ | □ | |
| 4 | **Clic sur une ligne** du tableau → ouvre bien la fiche du client correspondant | □ | □ | □ | |
| 5 | **Recherche par nom** (barre du haut) → le tableau se filtre en direct, insensible à la casse | □ | □ | □ | |
| 6 | **Menu « Avancé »** (header desktop) → accessible en un clic, contient bien tous les outils : Atelier (6), Veille Marché, Prospection, Prompts, Notes rapides, Atelier Média, Mode Focus, Objectifs & KPIs, Briefing, Guide | □ | □ | □ | |
| 7 | **Facturation intacte** : bouton Facturation (header) ouvre `/finances` ; créer/éditer/envoyer une facture fonctionne comme avant ; `InvoiceBuilder` non modifié | □ | □ | □ | |

---

## P1 — Importants (souhaitables)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 8 | **Tri nom / progression** : les autres en-têtes triables fonctionnent (Client, Progression) | □ | □ | □ | |
| 9 | **Dossier vide** : sélectionner un statut sans client → message « Aucun client dans ce dossier » centré, avec icône dossier | □ | □ | □ | |
| 10 | **Santé** : la pastille (verte/orange/rouge) reflète bien `getProjectHealth` (facture en retard ou tâche en retard = rouge) | □ | □ | □ | |
| 11 | **Bordure d'alerte** : une ligne avec deadline dans les 7 jours ou en danger a une fine bordure rose (`#b05070`) ; une ligne « à surveiller » a une bordure ambre | □ | □ | □ | |
| 12 | **Agenda** : bouton Agenda (icône calendrier, header) ouvre l'agenda complet en fenêtre ; ajouter/modifier/supprimer un événement fonctionne | □ | □ | □ | |
| 13 | **Nouveau client** : bouton « + Nouveau » ouvre toujours l'écran de création, et l'export CSV fonctionne toujours | □ | □ | □ | |
| 14 | **Responsive mobile** : sur petit écran, l'arborescence devient une rangée de pastilles (chips) en haut, scrollable horizontalement ; le tableau masque « Prochaine action » et « Montant dû » | □ | □ | □ | |
| 15 | **Menu mobile (☰)** : section « Quotidien » toujours visible (Ma journée, Clients, Agenda, Emails, Franck, Paramètres) ; section « Avancé » repliée par défaut, s'ouvre au clic | □ | □ | □ | |
| 16 | **Palette Eonora respectée** : aucune couleur orange ou violet/indigo « IA » n'est apparue dans la nouvelle vue Clients ou le nouveau menu Avancé — uniquement crème `#FAF7F2`, sage `#7C9A7E`, dégradé signature rose → bleu → teal, et les couleurs sémantiques (vert/orange/rouge pour la santé) | □ | □ | □ | |

---

## Critères GO (cocher ensemble en fin de session)

- [ ] Tous les **P0** sont Pass (ou N/A justifié)
- [ ] Aucun Fail P0 ouvert sans workaround écrit
- [ ] La facturation (création, envoi, paiement de facture) fonctionne exactement comme avant
- [ ] La palette Eonora est respectée partout dans la nouvelle vue Clients et le menu Avancé
- [ ] Version affichée / stamp cohérent avec **v2.11.0**

### Décision

| Décision | Cocher | Signature / date |
|----------|--------|------------------|
| **GO** — release quotidienne OK | □ | |
| **NO-GO** — bloquant à corriger avant | □ | |
| **GO avec réserves** (noter ci-dessous) | □ | |

Réserves / bugs ouverts :
```
…
```

---

## Rappels session

1. Suivre [`INSTRUCTIONS_MARION.md`](./INSTRUCTIONS_MARION.md) (section « Où trouver quoi ») pendant les tests.
2. En cas d'échec : capture + `.marion.log` (jamais le `.env`).
3. Après MAJ : toujours **Cmd + Shift + R**.
4. Rien n'a été supprimé lors de cette release : tous les outils déplacés vers le menu « Avancé » restent accessibles, juste rangés ailleurs.
