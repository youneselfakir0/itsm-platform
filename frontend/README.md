# Frontend TwisterITSM

Le frontend **actif** est le dossier [`webapp/`](./webapp) — une application **React + Vite** (monolithic UI)
qui consomme l'API NestJS (`/api`).

## Structure

| Dossier | Statut | Description |
| --- | --- | --- |
| `webapp/` | ✅ **Actif / maintenu** | SPA React (Vite) : Tickets, Catalogue, CMDB, Automation, Dashboard, Copilote IA. Accessibilité (labels ARIA, skip-link), bilinguisme FR/EN, thème clair/sombre. |
| `portal/`, `tech-console/`, `admin-console/` | ⚠️ **Vestiges — non maintenus** | Reliquats de l'ancienne architecture microservices (P0–P2). Ils sont vides et ne font plus partie du build. À supprimer du disque (hors git, non versionnés). |

## Développement

```bash
cd webapp
npm install
npm run dev      # serveur de dev (Vite)
npm run build    # build de production -> dist/
```

L'app attend l'API sur `/api` (proxy Vite vers `:8080` en dev).
