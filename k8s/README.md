# TwisterITSM — Déploiement (Docker & Kubernetes)

Monolithe NestJS+Prisma (port 8080) + frontend React (statique) + nginx edge TLS.

## 1. Docker Compose (dev / on-prem single-host)

```bash
cp .env.example .env        # renseigner JWT_SECRET, POSTGRES_PASSWORD, SMTP/Teams
docker compose build
docker compose up -d
```

- API      : http://localhost:8080/api
- Web      : http://localhost:5174
- Edge TLS : https://itsm.twisterlab.local (nginx, ports 80/443, certs dans `nginx/certs/`)

Certificats auto-signés (dev) :
```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/tls.key -out nginx/certs/tls.crt \
  -subj "/CN=itsm.twisterlab.local"
```

## 2. Kubernetes (prod on-prem)

Manifests dans `k8s/` (ordre de appliquer) :

```bash
kubectl apply -f k8s/00-config.yaml
kubectl apply -f k8s/10-api.yaml
kubectl apply -f k8s/20-web.yaml
kubectl apply -f k8s/30-nginx.yaml
kubectl apply -f k8s/40-ingress.yaml
```

Pré-requis :
- Ingress controller nginx + cert-manager (cluster-issuer `selfsigned-ca`) installés.
- Images poussées vers `registry.twisterlab.local/twisteritsm/{api,web,nginx}:latest`.
- Secret TLS `itsm-tls` fourni par cert-manager (ou manuel).

Variables d'environnement (ConfigMap/Secret `k8s/00-config.yaml`) :
| Var | Usage |
|---|---|
| `DATABASE_URL` | PostgreSQL (service `postgres:5432` en K8s / host en compose) |
| `JWT_SECRET` | signature JWT (à générer : `openssl rand -base64 48`) |
| `AI_API_URL` / `AI_MODEL` / `AI_CODER_MODEL` | Ollama (RTX 192.168.0.20:11434) |
| `SMTP_*` | notifications email (DRY-RUN si absent) |
| `TEAMS_WEBHOOK` | notification Teams (DRY-RUN si absent) |
| `NOTIFY_EMAIL` | destinataire par défaut |
| `SLA_TIMER_MS` | intervalle d'évaluation SLA (défaut 60000) |

## 3. Migrations base

Les migrations SQL (`db/migrations/00x_*.sql`) sont idempotentes (`IF NOT EXISTS`).
À appliquer une fois la base prête :

```bash
DATABASE_URL=postgres://itsm:<pw>@<host>:5432/itsm npm run migrate
```

## 4. Healthchecks

- API : `GET /api/auth/health`
- Web : `GET /`
- SLA : timer automatique (60s) dans `WorkflowModule.onModuleInit`
