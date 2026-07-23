const { createService, listen, auth, need, q } = require('@itsm/svc-kit');

const app = createService('cmdb-service', (app) => {
  app.use(auth);

  app.get('/cmdb/classes', need('ci:read'), async (_req, res, next) => {
    try { res.json((await q(`SELECT * FROM cmdb.ci_classes ORDER BY name`)).rows); } catch (e) { next(e); }
  });

  // liste + filtres: ?class=server&status=active&attr.os=Ubuntu
  app.get('/cmdb/cis', need('ci:read'), async (req, res, next) => {
    try {
      const params = [];
      let where = 'WHERE 1=1';
      if (req.query.class) { params.push(req.query.class); where += ` AND cl.name = $${params.length}`; }
      if (req.query.status) { params.push(req.query.status); where += ` AND c.status = $${params.length}`; }
      for (const [k, v] of Object.entries(req.query)) {
        if (k.startsWith('attr.')) { params.push(JSON.stringify({ [k.slice(5)]: v })); where += ` AND c.attributes @> $${params.length}::jsonb`; }
      }
      const r = await q(
        `SELECT c.*, cl.name AS class FROM cmdb.cis c JOIN cmdb.ci_classes cl ON cl.id=c.class_id ${where} ORDER BY c.name LIMIT 500`,
        params);
      res.json(r.rows);
    } catch (e) { next(e); }
  });

  app.post('/cmdb/cis', need('ci:write'), async (req, res, next) => {
    try {
      const { class: cls, name, environment, attributes, status } = req.body;
      const c = await q(`SELECT id FROM cmdb.ci_classes WHERE name=$1`, [cls]);
      if (!c.rows[0]) return res.status(400).json({ error: `unknown class ${cls}` });
      const r = await q(
        `INSERT INTO cmdb.cis (class_id, name, environment, attributes, status, owner_id, discovered_by)
         VALUES ($1,$2,COALESCE($3,'prod'),COALESCE($4::jsonb,'{}'::jsonb),COALESCE($5,'active'),$6,'manual') RETURNING *`,
        [c.rows[0].id, name, environment, attributes ? JSON.stringify(attributes) : null, status, req.user.sub]);
      res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
  });

  app.get('/cmdb/cis/:id', need('ci:read'), async (req, res, next) => {
    try {
      const ci = await q(`SELECT c.*, cl.name AS class FROM cmdb.cis c JOIN cmdb.ci_classes cl ON cl.id=c.class_id WHERE c.id=$1`, [req.params.id]);
      if (!ci.rows[0]) return res.status(404).json({ error: 'not found' });
      const rel = await q(
        `SELECT r.relation, r.target_id, t.name AS target_name, 'out' AS dir FROM cmdb.ci_relations r JOIN cmdb.cis t ON t.id=r.target_id WHERE r.source_id=$1
         UNION ALL
         SELECT r.relation, r.source_id, s.name, 'in' FROM cmdb.ci_relations r JOIN cmdb.cis s ON s.id=r.source_id WHERE r.target_id=$1`,
        [req.params.id]);
      const hist = await q(`SELECT * FROM cmdb.ci_history WHERE ci_id=$1 ORDER BY at DESC LIMIT 50`, [req.params.id]);
      res.json({ ...ci.rows[0], relations: rel.rows, history: hist.rows });
    } catch (e) { next(e); }
  });

  app.patch('/cmdb/cis/:id', need('ci:write'), async (req, res, next) => {
    try {
      const allowed = ['name', 'status', 'environment', 'attributes', 'owner_id'];
      const sets = [], params = [];
      for (const k of allowed) if (req.body[k] !== undefined) { params.push(req.body[k]); sets.push(`${k}=$${params.length}`); }
      if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
      params.push(req.params.id);
      const r = await q(`UPDATE cmdb.cis SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`, params);
      if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(r.rows[0]);
    } catch (e) { next(e); }
  });

  app.post('/cmdb/relations', need('ci:write'), async (req, res, next) => {
    try {
      const { source_id, target_id, relation } = req.body;
      const r = await q(
        `INSERT INTO cmdb.ci_relations (source_id, target_id, relation) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING *`, [source_id, target_id, relation]);
      res.status(201).json(r.rows[0] || { note: 'already exists' });
    } catch (e) { next(e); }
  });
});

listen(app, 'cmdb-service', 3004);
