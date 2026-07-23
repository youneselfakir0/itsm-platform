// Connecteur SMTP minimal (nodemailer optionnel — fallback log).
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* optional */ }

async function run(action, params, dryRun, log) {
  if (action !== 'send_mail') return { ok: false, error: `unknown smtp action ${action}` };
  const { to, subject, body } = params || {};
  if (dryRun || !nodemailer || !process.env.SMTP_HOST) {
    log('info', `[DRY-RUN] mail to=${to} subject="${subject}"`);
    return { ok: true, dry_run: true, to, subject };
  }
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const info = await t.sendMail({ from: process.env.SMTP_FROM || 'itsm@localhost', to, subject, text: body });
  log('info', `mail sent ${info.messageId}`);
  return { ok: true, messageId: info.messageId };
}

module.exports = { run };
