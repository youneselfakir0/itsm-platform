// @itsm/svc-kit — socle commun des microservices Express.
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://itsm:itsm_dev_pw@localhost:5433/itsm',
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/** Middleware JWT: pose req.user ({sub, email, role, permissions}). */
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

/** Garde RBAC. */
const need = (perm) => (req, res, next) => {
  const p = req.user?.permissions || [];
  if (p.includes(perm) || p.includes('admin:*')) return next();
  res.status(403).json({ error: `missing permission ${perm}` });
};

/** Crée l'app avec health + json + error handler; cb(app) déclare les routes. */
function createService(name, cb) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ service: name, status: 'ok' }));
  cb(app);
  app.use((err, _req, res, _next) => {
    console.error(`[${name}]`, err);
    res.status(err.status || 500).json({ error: err.message || 'internal error' });
  });
  return app;
}

/** Démarre le service. */
function listen(app, name, defaultPort) {
  const port = Number(process.env.PORT || defaultPort);
  app.listen(port, () => console.log(`[${name}] listening on :${port}`));
}

const q = (text, params) => pool.query(text, params);

module.exports = { createService, listen, auth, need, q, pool };
