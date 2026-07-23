const { createService, listen, auth, need, q } = require('@itsm/svc-kit');

const app = createService('user-service', (app) => {
  app.use(auth);

  app.get('/users', need('user:read'), async (_req, res, next) => {
    try {
      const r = await q(`SELECT id, email, display_name, department, phone FROM users.users ORDER BY display_name`);
      res.json(r.rows);
    } catch (e) { next(e); }
  });

  app.get('/users/me', async (req, res, next) => {
    try {
      const r = await q(`SELECT id, email, display_name, department, phone FROM users.users WHERE id=$1`, [req.user.sub]);
      res.json(r.rows[0] || null);
    } catch (e) { next(e); }
  });

  app.get('/users/teams', need('user:read'), async (_req, res, next) => {
    try {
      const r = await q(`SELECT t.*, COALESCE(json_agg(tm.user_id) FILTER (WHERE tm.user_id IS NOT NULL),'[]') members
                         FROM users.teams t LEFT JOIN users.team_members tm ON tm.team_id=t.id GROUP BY t.id`);
      res.json(r.rows);
    } catch (e) { next(e); }
  });

  app.post('/users/teams', need('user:write'), async (req, res, next) => {
    try {
      const r = await q(`INSERT INTO users.teams (name) VALUES ($1) RETURNING *`, [req.body.name]);
      res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
  });
});

listen(app, 'user-service', 3002);
