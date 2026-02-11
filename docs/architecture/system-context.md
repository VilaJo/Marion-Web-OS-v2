# Contexte Système (C4 — Niveau 1)

## Diagramme

```mermaid
C4Context
    title Contexte Système - Marion Web OS
    
    Person(marion, "Marion", "Freelance créative utilisatrice")
    Person(client, "Client", "Utilisateur du portail client")
    
    System(mwos, "Marion Web OS", "Business OS local-first : CRM, projets, finances, IA")
    
    System_Ext(infomaniak, "Infomaniak Mail", "IMAP/SMTP — emails")
    System_Ext(google, "Google APIs", "Calendar, Drive, Gemini")
    
    Rel(marion, mwos, "Utilise quotidiennement")
    Rel(client, mwos, "Accède au portail (via lien)")
    Rel(mwos, infomaniak, "Récupère et envoie emails")
    Rel(mwos, google, "Agenda, Drive, IA")
```

## Acteurs

| Acteur | Description |
|--------|-------------|
| **Marion** | Utilisatrice principale — gère clients, projets, factures, emails, agenda |
| **Client** | Accède au portail public via un lien partagé (token), consulte livrables, commente, téléverse |

## Systèmes externes

| Système | Intégration |
|---------|-------------|
| **Infomaniak Mail** | IMAP (lecture) + SMTP (envoi) — boîte email professionnelle |
| **Google APIs** | OAuth2 — Google Calendar (événements), Drive (sync fichiers), Gemini (IA) |
