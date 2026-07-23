// API Gateway — point d'entrée unique, route vers les microservices.
// Monté à la racine avec pathFilter (http-proxy-middleware v3) pour éviter
// le stripping de préfixe d'express.
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const services = [
  { filter: '/api/auth', target: process.env.AUTH_URL || 'http://localhost:3001' },
  { filter: '/api/users', target: process.env.USER_URL || 'http://localhost:3002' },
  { filter: '/api/tickets', target: process.env.TICKETING_URL || 'http://localhost:3003' },
  { filter: '/api/cmdb', target: process.env.CMDB_URL || 'http://localhost:3004' },
  { filter: '/api/automation', target: process.env.AUTOMATION_URL || 'http://localhost:3005' },
  { filter: '/api/catalog', target: process.env.CATALOG_URL || 'http://localhost:3007' },
  { filter: '/api/reports', target: process.env.REPORTING_URL || 'http://localhost:3008' },
  { filter: '/api/ai', target: process.env.AI_URL || 'http://localhost:3009' },
];

app.get('/health', (_req, res) =>
  res.json({ service: 'gateway', status: 'ok', routes: services.map((s) => s.filter) }));

for (const { filter, target } of services) {
  app.use(createProxyMiddleware({
    pathFilter: (path) => path === filter || path.startsWith(filter + '/'),
    target,
    changeOrigin: true,
    // /api/<svc>/health -> /health ; sinon /api/x/y -> /x/y
    pathRewrite: (path) =>
      path === filter + '/health' ? '/health' : path.replace(/^\/api/, ''),
  }));
}

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`[gateway] listening on :${port}`));
