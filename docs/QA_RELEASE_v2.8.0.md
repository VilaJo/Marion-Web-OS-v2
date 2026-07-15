# Checklist QA — Release v2.8.0 (Marion + Johan)

Date session : _______________  
Machine Marion : _______________  
Build / commit : _______________  
Testeur(s) : Marion □  Johan □

Légende : **P** = Pass · **F** = Fail · **N/A** = non applicable

---

## P0 — Bloquants (obligatoires pour GO)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 1 | Double-clic **Eonora Tech OS** (.app / Bureau) → l’app démarre sans Terminal | □ | □ | □ | |
| 2 | Login / déverrouillage OK (mot de passe connu) | □ | □ | □ | |
| 3 | **Franck texte** : message envoyé, réponse Gemini reçue (mode Cloud + clé) | □ | □ | □ | |
| 4 | **Franck vocal** : micro autorisé, parole 1–2 s, transcription / réponse OK | □ | □ | □ | |
| 5 | **Client → tâche → facture** : créer/ouvrir un client, ajouter une tâche, créer une facture avec **QR** visible | □ | □ | □ | |
| 6 | **Emails** : boîte accessible **ou** message d’erreur / fallback clair (pas de plantage silencieux) | □ | □ | □ | |
| 7 | **Agenda** : vue du jour / événements visibles (Google connecté ou état vide clair) | □ | □ | □ | |
| 8 | **Chemin données** : clients visibles depuis `Bureau/Eonora Tech OS Database` (ou équivalent) | □ | □ | □ | |
| 9 | **`METTRE_A_JOUR.command`** puis relance + **Cmd+Shift+R** → pas d’écran blanc | □ | □ | □ | |
| 10 | Scripts autonomes Marion : **STOPPER** / **REPARER_INTERFACE** / **REINITIALISER_MOT_DE_PASSE** (au moins vérifier présence + un scénario réel si possible) | □ | □ | □ | |

---

## P1 — Importants (souhaitables)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 11 | **Today** : vue du jour utilisable | □ | □ | □ | |
| 12 | **Timer** : démarrer / arrêter un chronomètre sur une tâche | □ | □ | □ | |
| 13 | **Backup** : sauvegarde ou export accessible / confirmé | □ | □ | □ | |
| 14 | **Focus** : mode Focus s’ouvre et se ferme sans erreur | □ | □ | □ | |

---

## Critères GO (cocher ensemble en fin de session)

- [ ] Tous les **P0** sont Pass (ou N/A justifié)
- [ ] Aucun Fail P0 ouvert sans workaround écrit
- [ ] Marion peut lancer / arrêter / mettre à jour / réparer seule (scripts ci-dessus)
- [ ] Franck texte **et** vocal validés sur la machine de Marion
- [ ] Chemin Database Bureau confirmé
- [ ] Version affichée / stamp cohérent avec **v2.8.0**

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

1. Suivre [`INSTRUCTIONS_MARION.md`](./INSTRUCTIONS_MARION.md) pendant les tests.
2. En cas d’échec : capture + `.marion.log` (jamais le `.env`).
3. Après MAJ : toujours **Cmd + Shift + R**.
