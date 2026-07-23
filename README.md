# TwisterITSM — Plateforme ITSM moderne (concurrent ServiceNow)

Plateforme ITSM microservices : ticketing, CMDB dynamique, automatisation, catalogue de services, reporting et couche IA intégrée.

## Stack
| Couche | Techno | Justification |
|---|---|---|
| Backend | Node.js / **NestJS** (TypeScript) | Modulaire, DI native, décorateurs, écosystème mature |
| Frontend | **React 18 + Vite + Tailwind** | UI moderne, DX rapide |
| DB | **PostgreSQL 16** | Relationnel, JSONB pour CI attributes, partitioning audit |
| Cache / Queue | **Redis + BullMQ** | Workers async, jobs automation |
| Events | **NATS JetStream** | Bus événementiel léger inter-services |
| Gateway | **API Gateway NestJS** (BFF) + JWT/RBAC | Point d'entrée unique |
| IA | ai-service (LLM API + RAG pgvector) | Classification, suggestions, copilote |
| Déploiement | Docker Compose (dev) → Kubernetes `k8s/` (prod) | Standard TwisterLab |

## Architecture logique

```
                        ┌──────────────────────────────┐
                        │   FRONTEND (React+Tailwind)  │
                        │ Portail user │ Console tech  │
                        │        │ Console admin       │
                        └──────────────┬───────────────┘
                                       │ HTTPS
                              ┌────────▼────────┐
                              │   API GATEWAY   │  JWT · RBAC · Rate-limit
                              └────────┬────────┘
      ┌──────────┬───────────┬─────────┼──────────┬───────────┬──────────┐
      ▼          ▼           ▼         ▼          ▼           ▼          ▼
 ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐ ┌────────┐ ┌────────┐
 │ auth   │ │ user   │ │ticketing │ │ cmdb │ │catalog  │ │reporting│ │ ai    │
 │service │ │service │ │ service  │ │service│ │service │ │ service │ │service│
 └───┬────┘ └───┬────┘ └────┬─────┘ └──┬───┘ └────┬────┘ └────┬────┘ └───┬───┘
     │          │           │          │          │           │          │
     └──────────┴───────────┴────┬─────┴──────────┴───────────┴──────────┘
                                 │ publish/subscribe
                        ┌────────▼─────────┐
                        │  events-service  │  NATS JetStream
                        └────────┬─────────┘
                                 │
                     ┌───────────▼──────────────┐
                     │   automation-service     │  BullMQ workers
                     │ AD · AzureAD · VMware ·  │
                     │ Hyper-V · Zabbix · SMTP  │
                     └──────────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  PostgreSQL 16  │ (schéma par service)
                        │  Redis · pgvector│
                        └─────────────────┘
```

## Microservices

| Service | Port | Responsabilité | Événements émis |
|---|---|---|---|
| `auth-service` | 3001 | Login local + AD/AzureAD (OIDC), JWT (access/refresh), RBAC, MFA | `auth.login`, `auth.failed` |
| `user-service` | 3002 | Profils, équipes, groupes, sync AD | `user.created`, `user.synced` |
| `ticketing-service` | 3003 | Incidents, demandes, problèmes, changements, SLA, workflows | `ticket.created`, `ticket.updated`, `sla.breached` |
| `cmdb-service` | 3004 | CI dynamiques (JSONB), classes, relations, discovery | `ci.created`, `ci.changed` |
| `automation-service` | 3005 | Runbooks, exécution PowerShell/Bash, connecteurs AD/Azure/VMware/Hyper-V/Zabbix, webhooks, SMTP | `job.completed`, `job.failed` |
| `events-service` | 3006 | Bus NATS, corrélation événements → tickets (event management) | — |
| `catalog-service` | 3007 | Catalogue de services, formulaires dynamiques, approbations | `request.submitted`, `request.approved` |
| `reporting-service` | 3008 | KPIs, dashboards, exports, agrégats matérialisés | — |
| `ai-service` | 3009 | Classification tickets, suggestion résolution, génération scripts, analyse logs, copilote (RAG pgvector) | `ai.classified` |

## Flux de données clés
1. **Création ticket** : Portail → Gateway → ticketing → publish `ticket.created` → ai-service classe (catégorie/priorité/assignation) → events notifie (SMTP/webhook).
2. **Event management** : Zabbix/Prometheus → webhook events-service → corrélation → auto-ticket + lien CI CMDB.
3. **Automation** : ticket "reset password" → catalog → approbation → automation-service → connecteur AD → résultat journalisé + audit.
4. **Copilote** : console tech → ai-service (contexte ticket + CI + historique via RAG) → suggestions/scripts.

## Modèle de données (noyau — schéma par service)
- `auth`: users_auth, roles, permissions, role_permissions, refresh_tokens
- `users`: users, teams, team_members
- `ticketing`: tickets (partitionné par mois), ticket_comments, ticket_history (audit), slas, workflows, workflow_transitions
- `cmdb`: ci_classes, cis (attrs JSONB + index GIN), ci_relations, ci_history
- `catalog`: catalog_items, request_forms (JSONB), requests, approvals
- `automation`: runbooks, jobs, job_logs, connectors, credentials (chiffré)
- `ai`: embeddings (pgvector), classifications, suggestions_feedback

Toutes les tables : `id uuid pk`, `created_at`, `updated_at`, audit trigger → `*_history`.

## Sécurité
- JWT RS256 (clé privée auth-service, publique distribuée), refresh rotation
- RBAC: roles → permissions granulaires (`ticket:read`, `ci:write`, `automation:execute`…)
- Secrets connecteurs chiffrés (AES-256-GCM), jamais en clair
- Règle dure : **aucune exécution automation sur compte réel en environnement de test**

## Structure du repo
```
itsm-platform/
├── services/
│   ├── auth-service/ ... ai-service/     # NestJS chacun
├── frontend/
│   ├── portal/        # portail utilisateur
│   ├── tech-console/  # console technicien
│   └── admin-console/ # console admin
├── packages/
│   ├── shared/        # DTOs, types, events contracts
│   └── sdk/           # client API généré
├── infra/
│   ├── docker-compose.yml
│   └── k8s/
├── db/migrations/
└── docs/
```

## Roadmap
- **P0** ✅ : monorepo, auth + ticketing + gateway, migrations, RBAC
- **P1** ✅ : cmdb + catalog + automation (connecteur AD dry-run + comptes protégés)
- **P2** ✅ : events (webhook + corrélation) + reporting + ai-service (classification, suggestions, scripts, logs)
- **P3** ✅ : frontend React+Tailwind (portail/tech/admin unifiés par RBAC), Dockerfiles, manifests K8s

## Démarrage rapide (dev)
```bash
docker --context twisterlab-ubuntu compose -p itsm -f infra/docker-compose.yml up -d
npm install
export DATABASE_URL='postgres://itsm:itsm_dev_pw@192.168.0.30:5433/itsm'
bash scripts/dev-up.sh          # migre + démarre les 10 services
cd frontend/webapp && npm run dev   # UI sur :5173 (proxy /api -> :8080)
```
Voir `docs/API.md` pour la référence API complète.
