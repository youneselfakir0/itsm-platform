const { createService, listen, auth, need, q } = require('@itsm/svc-kit');
const connectors = {
  ad: require('./connectors/ad'),
  smtp: require('./connectors/smtp'),
};

async function addLog(jobId, level, message) {
  await q(`INSERT INTO automation.job_logs (job_id, level, message) VALUES ($1,$2,$3)`, [jobId, level, message]);
}

// Worker in-process : poll la queue toutes les 3s.
async function processQueue() {
  const j = (await q(
    `UPDATE automation.jobs SET status='running', started_at=now()
     WHERE id = (SELECT id FROM automation.jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING *`)).rows[0];
  if (!j) return;
  const rb = (await q(`SELECT * FROM automation.runbooks WHERE id=$1`, [j.runbook_id])).rows[0];
  const log = (lvl, msg) => addLog(j.id, lvl, msg).catch(() => {});
  let result;
  try {
    const conn = connectors[rb.connector];
    result = conn
      ? await conn.run(rb.action, j.params, j.dry_run, log)
      : { ok: false, error: `connector ${rb.connector} not implemented` };
  } catch (e) {
    result = { ok: false, error: e.message };
  }
  await q(`UPDATE automation.jobs SET status=$1, result=$2, finished_at=now() WHERE id=$3`,
    [result.ok ? 'succeeded' : 'failed', JSON.stringify(result), j.id]);
}
setInterval(() => processQueue().catch((e) => console.error('[worker]', e.message)), 3000);

const app = createService('automation-service', (app) => {
  app.use(auth);

  app.get('/automation/runbooks', need('automation:read'), async (_req, res, next) => {
    try { res.json((await q(`SELECT * FROM automation.runbooks ORDER BY name`)).rows); } catch (e) { next(e); }
  });

  app.post('/automation/jobs', need('automation:execute'), async (req, res, next) => {
    try {
      const { runbook, params, dry_run } = req.body;
      const rb = (await q(`SELECT * FROM automation.runbooks WHERE name=$1`, [runbook])).rows[0];
      if (!rb) return res.status(404).json({ error: `runbook ${runbook} not found` });
      const r = await q(
        `INSERT INTO automation.jobs (runbook_id, requested_by, params, dry_run) VALUES ($1,$2,$3,$4) RETURNING *`,
        [rb.id, req.user.sub, params || {}, dry_run !== false]); // dry-run par défaut
      res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
  });

  app.get('/automation/jobs', need('automation:read'), async (_req, res, next) => {
    try {
      res.json((await q(
        `SELECT j.*, r.name AS runbook FROM automation.jobs j LEFT JOIN automation.runbooks r ON r.id=j.runbook_id
         ORDER BY j.created_at DESC LIMIT 100`)).rows);
    } catch (e) { next(e); }
  });

  app.get('/automation/jobs/:id', need('automation:read'), async (req, res, next) => {
    try {
      const j = (await q(`SELECT j.*, r.name AS runbook FROM automation.jobs j LEFT JOIN automation.runbooks r ON r.id=j.runbook_id WHERE j.id=$1`, [req.params.id])).rows[0];
      if (!j) return res.status(404).json({ error: 'not found' });
      const logs = (await q(`SELECT level, message, at FROM automation.job_logs WHERE job_id=$1 ORDER BY at`, [req.params.id])).rows;
      res.json({ ...j, logs });
    } catch (e) { next(e); }
  });
});

listen(app, 'automation-service', 3005);
