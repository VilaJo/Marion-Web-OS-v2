# Containers (C4 — Niveau 2)

## Diagramme

```mermaid
C4Container
    title Containers - Marion Web OS
    
    Person(marion, "Marion")
    
    Container_Boundary(mwos, "Marion Web OS") {
        Container(spa, "SPA React", "Vite, TypeScript, Tailwind, React Query")
        Container(flask, "Flask API", "Python 3.12+, Blueprints, Auth")
        Container(sqldb, "SQLite", "Auth, OAuth, projets, portail, email")
        Container(jsonfs, "Filesystem JSON", "project.json, dossiers clients")
    }
    
    Rel(marion, spa, "Navigue")
    Rel(spa, flask, "REST API")
    Rel(flask, sqldb, "SQL")
    Rel(flask, jsonfs, "Lecture/écriture")
```

## Détail des containers

| Container | Technologie | Responsabilité |
|-----------|-------------|----------------|
| **SPA React** | React 19, Vite, TypeScript | UI, routing, state (Zustand, React Query), appels API |
| **Flask API** | Flask, Blueprints | REST, auth, orchestration services, CORS |
| **SQLite** | SQLite | Users, sessions, OAuth tokens, projects, tasks, invoices, events, portal |
| **Filesystem JSON** | Fichiers `.json` | `project.json` par client (tâches, profile, brand, moodboard) |

## Alternative : vue simplifiée

```mermaid
flowchart TB
    subgraph Frontend["Frontend"]
        UI[Composants UI]
        Store[Zustand]
        RQ[React Query]
    end
    
    subgraph Backend["Backend"]
        API[Flask Blueprints]
        Auth[Auth Middleware]
    end
    
    subgraph Data["Données"]
        DB[(SQLite)]
        FS[Fichiers JSON]
    end
    
    UI --> Store
    UI --> RQ
    RQ -->|apiFetch| API
    API --> Auth
    Auth --> DB
    Auth --> FS
```
