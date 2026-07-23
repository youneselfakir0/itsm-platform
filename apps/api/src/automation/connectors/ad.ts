// Connecteur Active Directory — génère/exécute via PowerShell (WinRM sur TWISTER-WIN).
// RÈGLE DURE : jamais d'exécution réelle sur un compte protégé ; dry_run par défaut.
const PROTECTED = ['administrator', 'admin', 'krbtgt', 'guest'];
const ALLOW_REAL = process.env.ALLOW_REAL_AD === '1';

function psFor(action: string, p: Record<string, any>): string {
  switch (action) {
    case 'reset_password': return `Set-ADAccountPassword -Identity "${p.samAccountName}" -Reset -NewPassword (ConvertTo-SecureString "***" -AsPlainText -Force)`;
    case 'disable_user': return `Disable-ADAccount -Identity "${p.samAccountName}"`;
    case 'unlock_user': return `Unlock-ADAccount -Identity "${p.samAccountName}"`;
    case 'add_group': return `Add-ADGroupMember -Identity "${p.group}" -Members "${p.samAccountName}"`;
    default: return `# action inconnue: ${action}`;
  }
}

export async function runAd(action: string, params: Record<string, any>, dryRun: boolean) {
  const sam = String(params.samAccountName ?? '').toLowerCase();
  if (PROTECTED.includes(sam)) {
    return { ok: false, status: 'failed', error: 'protected account — refused', command: psFor(action, params) };
  }
  const command = psFor(action, params);
  if (dryRun || !ALLOW_REAL) {
    return { ok: true, status: 'succeeded', dry_run: true, command, note: 'dry-run: commande générée, non exécutée' };
  }
  // Exécution réelle via WinRM désactivée en environnement de test (garde-fou).
  return { ok: false, status: 'failed', error: 'real execution disabled in this environment', command };
}
