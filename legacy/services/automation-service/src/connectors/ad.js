// Connecteur Active Directory — exécute via PowerShell.
// RÈGLE DURE : jamais d'exécution réelle sur un compte réel en test.
// dry_run=true (défaut) => la commande est générée et LOGGÉE, pas exécutée.
// L'exécution réelle exige dry_run=false ET ALLOW_REAL_AD=1 dans l'env.
const { execFile } = require('child_process');

const ACTIONS = {
  reset_password: (p) =>
    `Set-ADAccountPassword -Identity '${p.sam}' -Reset -NewPassword (ConvertTo-SecureString '${p.new_password || '<generated>'}' -AsPlainText -Force)`,
  disable_user: (p) => `Disable-ADAccount -Identity '${p.sam}'`,
  enable_user: (p) => `Enable-ADAccount -Identity '${p.sam}'`,
  unlock_user: (p) => `Unlock-ADAccount -Identity '${p.sam}'`,
  get_user: (p) => `Get-ADUser -Identity '${p.sam}' -Properties Enabled,LockedOut,PasswordExpired | ConvertTo-Json`,
};

const READONLY = new Set(['get_user']);

function run(action, params, dryRun, log) {
  return new Promise((resolve) => {
    const builder = ACTIONS[action];
    if (!builder) return resolve({ ok: false, error: `unknown AD action ${action}` });
    if (params?.sam && /^administrator$/i.test(params.sam)) {
      log('error', `REFUS: action sur compte protégé '${params.sam}'`);
      return resolve({ ok: false, error: 'protected account — refused' });
    }
    const cmd = builder(params || {});
    const mayExecute = READONLY.has(action) || (!dryRun && process.env.ALLOW_REAL_AD === '1');
    if (!mayExecute) {
      log('info', `[DRY-RUN] ${cmd}`);
      return resolve({ ok: true, dry_run: true, command: cmd });
    }
    log('info', `[EXEC] ${cmd}`);
    execFile('powershell', ['-NoProfile', '-Command', cmd], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) { log('error', stderr || err.message); return resolve({ ok: false, error: stderr || err.message }); }
      resolve({ ok: true, output: stdout.trim() });
    });
  });
}

module.exports = { run, ACTIONS };
