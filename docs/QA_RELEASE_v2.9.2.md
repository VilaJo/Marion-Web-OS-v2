# Checklist QA — Release v2.9.2 (Marion + Johan)

Date session : _______________  
Machine Marion : _______________  
Build / commit : _______________  
Testeur(s) : Marion □  Johan □

Légende : **P** = Pass · **F** = Fail · **N/A** = non applicable

---

## P0 — Bloquants (obligatoires pour GO)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 1 | **Lien HTTPS ouvert depuis le téléphone**, hors du WiFi de Marion (4G/5G ou autre réseau) → le portail s'affiche | □ | □ | □ | |
| 2 | **Auth PIN** : code correct → accès portail. Code faux **5 fois** → blocage avec message « Réessayez dans 15 minutes » | □ | □ | □ | |
| 3 | **Commentaire + upload fichier** côté client, puis **téléchargement d'un livrable** → tout fonctionne sans erreur | □ | □ | □ | |
| 4 | **Arrêt du tunnel / mise en veille du Mac** → le client voit une erreur claire sur le lien, et Marion voit le bandeau **« Lien public inactif »** dans l'app | □ | □ | □ | |
| 5 | **Copier le lien** depuis ClientPortal = bien `PUBLIC_BASE_URL/portal/…` (pas `127.0.0.1`) | □ | □ | □ | |

---

## P1 — Importants (souhaitables)

| # | Test | P | F | N/A | Notes |
|---|------|---|---|-----|-------|
| 6 | **Redémarrage du tunnel** → le bandeau repasse à « Lien public actif » en moins de 20 secondes | □ | □ | □ | |
| 7 | **OAuth Google publié (Johan)** → Agenda ne se déconnecte plus en 7 jours | □ | □ | □ | |

---

## Critères GO (cocher ensemble en fin de session)

- [ ] Tous les **P0** sont Pass (ou N/A justifié)
- [ ] Aucun Fail P0 ouvert sans workaround écrit
- [ ] Le lien public copié depuis ClientPortal fonctionne bien depuis un téléphone hors du WiFi de Marion
- [ ] Le bandeau tunnel (actif / inactif / aperçu local) reflète l'état réel du tunnel
- [ ] Version affichée / stamp cohérent avec **v2.9.2**

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
2. En cas d'échec : capture + `.marion.log` (jamais le `.env`).
3. Après MAJ : toujours **Cmd + Shift + R**.
4. Le tunnel public se lance avec `LANCER_PORTAIL_PUBLIC.command` et s'arrête avec `STOPPER_PORTAIL_PUBLIC.command`.
