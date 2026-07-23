const { createService, listen, auth, need, q } = require('@itsm/svc-kit');

const app = createService('reporting-service', (app) => {
  app.use(auth);

  app.get('/reports/overview', need('report:read'), async (_req, res, next) => {
    try {
      const [tickets, byStatus, byPriority, mttr, cis, jobs] = await Promise.all([
        q(`SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status NOT IN ('closed','cancelled'))::int AS open,
                  count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS last7d
           FROM ticketing.tickets`),
        q(`SELECT status, count(*)::int FROM ticketing.tickets GROUP BY status`),
        q(`SELECT priority, count(*)::int FROM ticketing.tickets WHERE status NOT IN ('closed','cancelled') GROUP BY priority`),
        q(`SELECT COALESCE(avg(EXTRACT(EPOCH FROM resolved_at - created_at))/3600, 0)::numeric(10,2) AS mttr_hours
           FROM ticketing.tickets WHERE resolved_at IS NOT NULL`),
        q(`SELECT cl.name AS class, count(*)::int FROM cmdb.cis c JOIN cmdb.ci_classes cl ON cl.id=c.class_id GROUP BY cl.name`),
        q(`SELECT status, count(*)::int FROM automation.jobs GROUP BY status`),
      ]);
      res.json({
        tickets: tickets.rows[0],
        by_status: byStatus.rows,
        by_priority: byPriority.rows,
        mttr_hours: Number(mttr.rows[0].mttr_hours),
        cmdb: cis.rows,
        automation: jobs.rows,
      });
    } catch (e) { next(e); }
  });

  app.get('/reports/tickets-per-day', need('report:read'), async (_req, res, next) => {
    try {
      res.json((await q(
        `SELECT date_trunc('day', created_at)::date AS day, count(*)::int
         FROM ticketing.tickets WHERE created_at > now() - interval '30 days'
         GROUP BY 1 ORDER BY 1`)).rows);
    } catch (e) { next(e); }
  });
});

listen(app, 'reporting-service', 3008);
