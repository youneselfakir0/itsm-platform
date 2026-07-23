const { createService, listen, auth, need, q } = require('@itsm/svc-kit');
const { classify, suggest, genScript } = require('./engine');

const app = createService('ai-service', (app) => {
  app.use(auth);

  // Classification d'un ticket (appelée à la création ou à la demande)
  app.post('/ai/classify', need('ai:use'), async (req, res, next) => {
    try {
      const { ticket_id, title, description } = req.body;
      const c = await classify(title, description);
      if (ticket_id) {
        await q(
          `INSERT INTO ai.classifications (ticket_id, suggested_category, suggested_priority, suggested_team, confidence, model)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [ticket_id, c.category, c.priority, c.team, c.confidence, c.model]);
      }
      res.json(c);
    } catch (e) { next(e); }
  });

  // Suggestions de résolution
  app.post('/ai/suggest', need('ai:use'), async (req, res, next) => {
    try { res.json(await suggest(req.body)); } catch (e) { next(e); }
  });

  // Génération de script PowerShell/Bash
  app.post('/ai/script', need('ai:use'), async (req, res, next) => {
    try { res.json(await genScript(req.body.request)); } catch (e) { next(e); }
  });

  // Analyse de logs
  app.post('/ai/analyze-logs', need('ai:use'), async (req, res, next) => {
    try {
      const lines = String(req.body.logs || '').split('\n');
      const errors = lines.filter((l) => /error|fail|critical|exception|denied/i.test(l));
      const warnings = lines.filter((l) => /warn/i.test(l));
      res.json({
        total_lines: lines.length,
        errors: errors.slice(0, 20),
        warnings: warnings.slice(0, 20),
        summary: `${errors.length} erreurs, ${warnings.length} warnings sur ${lines.length} lignes.`,
      });
    } catch (e) { next(e); }
  });

  // Feedback copilote
  app.post('/ai/feedback', need('ai:use'), async (req, res, next) => {
    try {
      const { ticket_id, suggestion, helpful } = req.body;
      await q(`INSERT INTO ai.suggestions_feedback (ticket_id, suggestion, helpful) VALUES ($1,$2,$3)`,
        [ticket_id, suggestion, helpful]);
      res.status(201).json({ ok: true });
    } catch (e) { next(e); }
  });
});

listen(app, 'ai-service', 3009);
