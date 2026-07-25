# Gestion des secrets — itsm-platform

Ce projet est destiné à un dépôt **public**. Aucune valeur secrète réelle ne doit
être commitée. Ce document explique où chaque secret est défini et comment le
fournir au déploiement.

## Principe

- Les manifests `k8s/**/00-config.example.yaml` sont commités **sans aucune valeur
  secrète** (Secret template vide + ConfigMap sans mot de passe).
- Les valeurs de laboratoire vivent dans `k8s/onprem/00-secrets.local.yaml`, qui est
  **gitignoré** (jamais suivi).
- En production, les secrets doivent être fournis par un gestionnaire externe
  (sealed-secrets, Vault, SOPS, ou variables d'env CI) — pas en clair dans le repo.

## Secrets attendus (Secret `itsm-secrets`, namespace `twisteritsm`)

| Clé               | Usage                                   | Génération                                   |
|-------------------|-----------------------------------------|----------------------------------------------|
| `JWT_SECRET`      | Signature des tokens JWT                | `openssl rand -base64 48`                    |
| `DATABASE_URL`    | URL complète de connexion PostgreSQL    | `postgres://<user>:<pw>@<host>:<port>/<db>`  |
| `POSTGRES_PASSWORD` | Mot de passe DB (si provisioning)     | `openssl rand -base64 24`                    |
| `SMTP_HOST`       | Relay SMTP (notifications)              | fourni par ton provider mail                 |
| `SMTP_PORT`       | Port SMTP (défaut 587)                  | —                                            |
| `SMTP_USER`       | Compte SMTP                             | —                                            |
| `SMTP_PASS`       | Mot de passe SMTP                       | —                                            |
| `TEAMS_WEBHOOK`   | Webhook Microsoft Teams (notifications) | URL du connecteur Teams                      |

## Fournir les secrets (3 options)

### Option A — fichier local gitignoré (lab / dev)
Le fichier `k8s/onprem/00-secrets.local.yaml` est déjà prêt (valeurs de dev).
```bash
kubectl apply -f k8s/onprem/00-secrets.local.yaml
```

### Option B — create secret générique (one-shot)
```bash
kubectl create secret generic itsm-secrets -n twisteritsm \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=DATABASE_URL="postgres://itsm:<pw>@192.168.0.30:5433/itsm" \
  --from-literal=POSTGRES_PASSWORD="<pw>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Option C — templating externe (cloud générique)
Le manifeste `k8s/00-config.example.yaml` sert de template ; il nécessite un
templating (kustomize / helm) avant `apply` si on ne remplit pas le Secret à la main.

## Variables d'environnement (docker-compose / local sans K8s)
Pour un run local via `docker-compose`, copier `.env.example` en `.env` et renseigner
`POSTGRES_PASSWORD`, `JWT_SECRET`, etc. `.env` est gitignoré.

## Vérification pré-publication
Avant de rendre le dépôt public, relancer :
```bash
git log -p --all | grep -iE "JWT_SECRET|POSTGRES_PASSWORD|SMTP_PASS|TEAMS_WEBHOOK" \
  | grep -viE "change-me|dev_|example|placeholder|<|À remplir"
```
Aucune correspondance ne doit apparaître (sinon purge via `git filter-repo`).
