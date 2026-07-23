#!/usr/bin/env bash
# Déploiement TwisterITSM en Kubernetes (on-prem twisterlab.local)
set -euo pipefail

REGISTRY="${REGISTRY:-registry.twisterlab.local/twisteritsm}"
TAG="${TAG:-latest}"
KUBE_CTX="${KUBE_CTX:-twisterlab}"

echo "== Build des images =="
docker build -f apps/api/Dockerfile -t "$REGISTRY/api:$TAG" .
docker build -f frontend/webapp/Dockerfile -t "$REGISTRY/web:$TAG" .
docker build -f nginx/Dockerfile -t "$REGISTRY/nginx:$TAG" .

echo "== Push =="
docker push "$REGISTRY/api:$TAG"
docker push "$REGISTRY/web:$TAG"
docker push "$REGISTRY/nginx:$TAG"

echo "== Apply manifests =="
kubectl --context "$KUBE_CTX" apply -f k8s/00-config.yaml
kubectl --context "$KUBE_CTX" apply -f k8s/10-api.yaml
kubectl --context "$KUBE_CTX" apply -f k8s/20-web.yaml
kubectl --context "$KUBE_CTX" apply -f k8s/30-nginx.yaml
kubectl --context "$KUBE_CTX" apply -f k8s/40-ingress.yaml

echo "== Attente ready =="
kubectl --context "$KUBE_CTX" -n twisteritsm rollout status deploy/itsm-api
kubectl --context "$KUBE_CTX" -n twisteritsm rollout status deploy/itsm-web
echo "Done."
