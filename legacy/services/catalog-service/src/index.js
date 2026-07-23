const { createService, listen, auth, need, q } = require('@itsm/svc-kit');

const AUTOMATION_URL = process.env.AUTOMATION_URL || 'http://localhost:3005';

async function triggerRunbook(runbook, params, token) {
  const r = await fetch(`${AUTOMATION_URL}/automation/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ runbook, params, dry_run: true }),
  });
  return r.json();
}

const app = createService('catalog-service', (app) => {
  app.use(auth);

  app.get('/catalog/items', need('catalog:read'), async (_req, res, next) => {
    try { res.json((await q(`SELECT * FROM catalog.items WHERE active ORDER BY category, name`)).rows); } catch (e) { next(e); }
  });

  app.post('/catalog/requests', need('catalog:request'), async (req, res, next) => {
    try {
      const { item_id, form_data } = req.body;
      const item = (await q(`SELECT * FROM catalog.items WHERE id=$1 AND active`, [item_id])).rows[0];
      if (!item) return res.status(404).json({ error: 'item not found' });
      const status = item.requires_approval ? 'pending_approval' : 'approved';
      const r = await q(
        `INSERT INTO catalog.requests (item_id, requester_id, form_data, status) VALUES ($1,$2,$3,$4) RETURNING *`,
        [item_id, req.user.sub, form_data || {}, status]);
      const request = r.rows[0];
      if (item.requires_approval) {
        await q(`INSERT INTO catalog.approvals (request_id) VALUES ($1)`, [request.id]);
      } else if (item.automation_runbook) {
        // exécution directe (dry-run par défaut — règle de sécurité)
        const job = await triggerRunbook(item.automation_runbook, form_data, req.headers.authorization).catch((e) => ({ error: e.message }));
        return res.status(201).json({ ...request, job });
      }
      res.status(201).json(request);
    } catch (e) { next(e); }
  });

  app.get('/catalog/requests', need('catalog:read'), async (req, res, next) => {
    try {
      const canApprove = req.user.permissions.includes('catalog:approve') || req.user.permissions.includes('admin:*');
      const r = canApprove
        ? await q(`SELECT r.*, i.name AS item_name FROM catalog.requests r JOIN catalog.items i ON i.id=r.item_id ORDER BY r.created_at DESC LIMIT 200`)
        : await q(`SELECT r.*, i.name AS item_name FROM catalog.requests r JOIN catalog.items i ON i.id=r.item_id WHERE r.requester_id=$1 ORDER BY r.created_at DESC LIMIT 200`, [req.user.sub]);
      res.json(r.rows);
    } catch (e) { next(e); }
  });

  app.post('/catalog/requests/:id/decision', need('catalog:approve'), async (req, res, next) => {
    try {
      const { decision, comment } = req.body; // approved | rejected
      if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved|rejected' });
      await q(`UPDATE catalog.approvals SET approver_id=$1, decision=$2, comment=$3, decided_at=now() WHERE request_id=$4`,
        [req.user.sub, decision, comment, req.params.id]);
      const r = await q(`UPDATE catalog.requests SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
        [decision, req.params.id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
      const request = r.rows[0];
      if (decision === 'approved') {
        const item = (await q(`SELECT * FROM catalog.items WHERE id=$1`, [request.item_id])).rows[0];
        if (item?.automation_runbook) {
          const job = await triggerRunbook(item.automation_runbook, request.form_data, req.headers.authorization).catch((e) => ({ error: e.message }));
          return res.json({ ...request, job });
        }
      }
      res.json(request);
    } catch (e) { next(e); }
  });
});

listen(app, 'catalog-service', 3007);
