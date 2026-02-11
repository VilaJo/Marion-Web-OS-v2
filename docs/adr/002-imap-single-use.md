# ADR 002 : Connexions IMAP single-use (pas de pool)

## Statut

Accepté

## Contexte

Des erreurs `ssl.SSLError`, `segmentation fault` et `leaked semaphore objects` survenaient lors de l'utilisation de l'email, notamment avec Python 3.14 sur macOS ARM.

## Décision

Supprimer le pool de connexions IMAP. Chaque requête email crée une **nouvelle connexion** IMAP, l'utilise, puis la ferme proprement.

## Raisons

1. **Thread-safety** : Les objets SSL/IMAP ne sont pas thread-safe. Le pool partagé entre requêtes Flask (multi-thread) provoquait des corruptions.
2. **Simplicité** : Moins de code, pas de gestion de timeouts ou de cleanup.
3. **Coût acceptable** : Pour un usage desktop, le surcoût d'ouverture/fermeture par requête est négligeable.

## Conséquences

- `email_service.py` n'utilise plus de pool.
- Contexte `_IMAPContext` : `__enter__` crée une connexion, `__exit__` fait `logout()`.
- Plus de segmentation fault liée à l'email.
