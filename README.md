# TwisterITSM — Plateforme ITSM (Modular Monolith)

[![CI](https://github.com/youneselfakir0/itsm-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/youneselfakir0/itsm-platform/actions/workflows/ci.yml)

ITSM moderne pour l'administration IT : incidents, demandes, CMDB, catalogue de
services avec approbations, automatisation Active Directory, workflows/SLA,
reporting et une couche IA (Ollama) intégrée. Conçue comme une **alternative
on-premise légère** à ServiceNow / Jira Service Management.

> Projet portfolio (administration IT) — code testé, documenté et sûr, destiné
> à une publication publique. Voir `docs/SECRETS.md` pour la gestion des secrets.

## Stack technique

| Couche | Technologie | Raison |
|---|---|---|
| Backend | **NestJS (monolithic modulaire) + TypeScript** | Un seul process, modules à frontières de domaine nettes, DI, décorateurs |
| ORM | **Prisma + PostgreSQL 16** | Typage, migrations, JSONB pour les attributs de CI |
| Frontend | **React 18 + Vite + Tailwind** | UI moderne, démarrage rapide |
| Edge | **Nginx** (TLS + reverse proxy) | Terminaison TLS, routage `/api` → API |
| Déploiement | **Docker Compose** (dev) → **Kubernetes / K3s** (`k8s/`) | Standard lab |
| IA | **Ollama** (qwen3:8b) en local, fallback heuristique | Pas de dépendance cloud, jamais de blocage si le GPU est down |

## Architecture — Modular Monolith

Un seul déployable NestJS, découpé en modules métier cohérents (pas de réseau
inter-services). Chaque module possède ses controllers, services, et (souvent)
ses tables Prisma :

```
                         ┌──────────────────────────────┐
                         │   Frontend (React+Tailwind)  │
                         └──────────────┬───────────────┘
                                        │ HTTPS /api
                         ┌──────────────▼───────────────┐
                         │   Nginx (TLS, reverse proxy) │
                         └──────────────┬───────────────┘
                                        │
                         ┌──────────────▼───────────────┐
                         │   NestJS Modular Monolith    │
                         │  (1 process, modules isolés) │
                         ├──────────────────────────────┤
                         │ identity │ ticketing │ cmdb  │
                         │ catalog  │ automation │ events│
                         │ workflow │ reporting  │ ai    │
                         │ notifications                │
                         └──────────────┬───────────────┘
                                        │ Prisma
                         ┌──────────────▼───────────────┐
                         │   PostgreSQL 16 (schéma itsm)│
                         └──────────────────────────────┘
```

Modules internes et responsabilités :

| Module | Responsabilité |
|---|---|
| `identity` | Auth (JWT + refresh), RBAC, MFA TOTP, sync/LDAP AD |
| `ticketing` | Incidents, demandes, commentaires, historique d'audit |
| `cmdb` | Configuration Items (JSONB), classes, relations, **discovery AD** |
| `catalog` | Catalogue de services, demandes, **approbations** |
| `automation` | Runbooks + connecteur **Active Directory via WinRM** (dry-run par défaut) |
| `events` | Webhooks + corrélation événement → ticket (event management) |
| `workflow` | Politiques SLA, **calcul + détection de breach idempotente**, approbations |
| `reporting` | KPIs / tableau de bord |
| `ai` | Classification, suggestion de résolution, génération de scripts, analyse de logs |
| `notifications` | SMTP (DRY-RUN si non config) + webhook Microsoft Teams |

## Pourquoi ces choix (raisonnement orienté admin IT)

- **Modular monolith, pas de microservices** : en lab / PME, le coût ops d'un
  maillage de 9 services (service mesh, queues, réseau) dépasse le bénéfice.
  On garde des frontières de domaine propres (modules) sans la complexité réseau.
- **Automation AD en `dry-run` par défaut** : une mauvaise action sur un compte
  AD (reset password, disable) est réversible seulement partiellement. Le
  garde-fou `dry_run=true` + un flag `ALLOW_REAL_AD=1` **explicite** évite les
  catastrophes sur un compte de production. Voir `ad.ts`.
- **Comptes protégés en dur** (`administrator`, `admin`, `krbtgt`, `guest`) :
  refusés *avant* toute validation de paramètre. Même avec `ALLOW_REAL_AD=1`,
  ces comptes ne sont jamais manipulés par l'automatisation.
- **Audit append-only** : chaque exécution AD (succès/échec/dry-run) est
  journalisée (`automation.ad_executions`) avec l'acteur. Traçabilité = prerequis
  de toute équipe IT sérieuse (conformité, post-mortem).
- **JWT + RBAC + MFA** : défense en profondeur standard. Le MFA TOTP est
  optionnel mais enclenchable par utilisateur ; les routes sensibles exigent
  des permissions explicites (`@Permissions(...)`).
- **IA avec fallback déterministe** : si Ollama est indisponible, l'endpoint
  `/ai/classify` retombe sur une heuristique locale — jamais de dépendance
  bloquante à un service externe.

## Démarrage rapide

### Vérification immédiate (sans infrastructure)

Build + tests unitaires sont exécutables sans base de données :

```bash
npm ci
npm run build --workspace @twisteritsm/api      # prisma generate + tsc
npm test --workspace @twisteritsm/api           # 23 tests (ad / workflow / mfa)
```

### Environnement complet (dev, nécessite PostgreSQL + Redis + Ollama)

```bash
# 1) Copier et renseigner les variables d'environnement
cp .env.example .env                            # voir docs/SECRETS.md
# 2) Démarrer l'infra (Postgres, Redis, Nginx, API, Web) via Compose
docker compose -f infra/docker-compose.yml up -d
# 3) Appliquer le schéma et lancer les migrations
npm run prisma:generate
node db/migrate.js
# 4) UI sur http://localhost:5173 (proxy /api -> :8080)
cd frontend/webapp && npm run dev
```

Le déploiement Kubernetes (K3s) est documenté dans `k8s/README.md` ; les
manifests de secrets y sont **exemples** (jamais de valeurs réelles, voir
`docs/SECRETS.md`).

## Documentation

- `docs/ARCHITECTURE.md` — architecture détaillée (modules, flux, sécurité)
- `docs/API.md` — référence des endpoints REST (`/api/...`)
- `docs/SECRETS.md` — gestion des secrets (aucun secret réel dans le repo)
- `legacy/` — ancienne architecture microservices (non maintenue, historique)

## Tests & CI

23 tests unitaires couvrent les garde-fous métier les plus démonstratifs :
connecteur AD (comptes protégés, dry-run, audit, exécution réelle mockée),
workflow SLA (détection de breach + escalade **idempotente**, approbations
multi-niveaux), et MFA TOTP. Le pipeline GitHub Actions build + test à chaque
push/PR sur `main`.

## Licence

MIT — voir `LICENSE`.
