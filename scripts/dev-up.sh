# Démarrage dev complet (bash / git-bash).
# Prérequis: docker compose (postgres+redis) up, npm install fait, migrations appliquées.
set -e
cd "$(dirname "$0")/.."
export DATABASE_URL="${DATABASE_URL:-postgres://itsm:itsm_dev_pw@localhost:5433/itsm}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"

node db/migrate.js

PORT=3001 node services/auth-service/dist/main.js &
PORT=3003 node services/ticketing-service/dist/main.js &
for s in user cmdb automation events catalog reporting ai; do
  node services/$s-service/src/index.js &
done
PORT=8080 node gateway/src/index.js &
echo "Tous les services démarrés. Gateway: http://localhost:8080 — Frontend: cd frontend/webapp && npm run dev"
wait
