const { createService, listen, auth, need, q } = require('@itsm/svc-kit');

const TICKETING_URL = process.env.TICKETING_URL || 'http://localhost:3003';
const SVC_TOKEN = process.env.SVC_TOKEN || ''; // JWT technicien de service pour auto-tickets

// Corrélation simple : événement critical non corrélé -> ticket p1 automatique.
async function correlate(ev) {
  if (ev.severity !== 'critical' || !SVC_TOKEN) return null;
  const r = await fetch(`${TICKETING_URL}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SVC_TOKEN}` },
    body: JSON.stringify({
      type: 'incident',
      title: `[AUTO] ${ev.subject}`,
      description: `Événement ${ev.source} corrélé automatiquement.\n\n${JSON.stringify(ev.payload, null, 2)}`,
      priority: 'p1',
      category: 'monitoring',
    }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  await q(`UPDATE events.events SET ticket_id=$1, correlated=true WHERE id=$2`, [t.id, ev.id]);
  return t.id;
}

const app = createService('events-service', (app) => {
  // Webhook entrant (Zabbix/Prometheus) — clé partagée au lieu de JWT.
  app.post('/events/webhook/:source', async (req, res, next) => {
    try {
      if (process.env.WEBHOOK_KEY && req.headers['x-webhook-key'] !== process.env.WEBHOOK_KEY) {
        return res.status(401).json({ error: 'bad webhook key' });
      }
      const { severity, subject, payload, ci_id } = req.body;
      const r = await q(
        `INSERT INTO events.events (source, severity, subject, payload, ci_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.params.source, severity || 'info', subject || 'event', payload || {}, ci_id || null]);
      const ev = r.rows[0];
      const ticketId = await correlate(ev).catch(() => null);
      res.status(201).json({ id: ev.id, ticket_id: ticketId });
    } catch (e) { next(e); }
  });

  app.use(auth);
  app.get('/events', need('ticket:read'), async (req, res, next) => {
    try {
      const params = [];
      let where = 'WHERE 1=1';
      if (req.query.severity) { params.push(req.query.severity); where += ` AND severity=$${params.length}`; }
      res.json((await q(`SELECT * FROM events.events ${where} ORDER BY at DESC LIMIT 200`, params)).rows);
    } catch (e) { next(e); }
  });
});

listen(app, 'events-service', 3006);
