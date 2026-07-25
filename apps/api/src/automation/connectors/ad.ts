// Connecteur Active Directory — exécution réelle via WinRM.
// Deux modes (AD_EXEC_MODE) :
//  - 'soap'  : client WinRM natif (NTLM/HTTP) — pour Linux/conteneurs (prod)
//  - 'powershell' : Invoke-Command via powershell.exe local — lab Windows (remoting natif OK)
// RÈGLE DURE : jamais d'exécution sur compte protégé ; dry_run par défaut sauf ALLOW_REAL_AD=1.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma.service';
import { execFile } from 'child_process';
import { winrmRun } from './winrm-client';

const PROTECTED = ['administrator', 'admin', 'krbtgt', 'guest'];
const AD_HOST = process.env.AD_HOST || '192.168.0.20';
const AD_PORT = Number(process.env.AD_PORT || 5985);
const AD_EXEC_MODE = process.env.AD_EXEC_MODE || 'soap';
const AD_SVC = process.env.AD_SVC || 'twisterlab.local\\svc-itsm';

// Lues à l'appel (pas au chargement) pour rester surchargeables via env sans redémarrer.
function allowRealAd() { return process.env.ALLOW_REAL_AD === '1'; }
function adSvcPw() { return process.env.AD_SVC_PW || ''; }

function psFor(action: string, p: Record<string, any>): string {
  const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  switch (action) {
    case 'reset_password':
      if (!p.newPassword) throw new Error('newPassword requis pour reset_password');
      return `Set-ADAccountPassword -Identity ${q(p.samAccountName)} -Reset -NewPassword (ConvertTo-SecureString ${q(p.newPassword)} -AsPlainText -Force)`;
    case 'disable_user':
      return `Disable-ADAccount -Identity ${q(p.samAccountName)}`;
    case 'unlock_user':
      return `Unlock-ADAccount -Identity ${q(p.samAccountName)}`;
    case 'add_group':
      return `Add-ADGroupMember -Identity ${q(p.group)} -Members ${q(p.samAccountName)}`;
    case 'create_user':
      if (!p.newPassword) throw new Error('newPassword requis pour create_user');
      return `New-ADUser -Name ${q(p.samAccountName)} -SamAccountName ${q(p.samAccountName)} -GivenName ${q(p.givenName ?? p.samAccountName)} -Surname ${q(p.surname ?? '')} -UserPrincipalName ${q(p.samAccountName + '@twisterlab.local')} -Path ${q(p.ou ?? 'OU=Onboarding,DC=twisterlab,DC=local')} -AccountPassword (ConvertTo-SecureString ${q(p.newPassword)} -AsPlainText -Force) -Enabled $true`;
    default:
      return `# action inconnue: ${action}`;
  }
}

export interface AdResult {
  ok: boolean;
  status: 'succeeded' | 'failed';
  dry_run?: boolean;
  command?: string;
  output?: string;
  error?: string;
  note?: string;
}

@Injectable()
export class AdConnector {
  constructor(private prisma?: PrismaService) {}

  private async audit(row: { action: string; target: string; params?: any; status: string; dry_run?: boolean; command?: string; output?: string; error?: string; actor_id?: string }) {
    if (!this.prisma) return;
    try { await this.prisma.ad_executions.create({ data: row as any }); } catch { /* best effort */ }
  }

  private async execReal(command: string): Promise<{ output: string; exitCode: number }> {
    if (AD_EXEC_MODE === 'powershell') {
      // Lab Windows : Invoke-Command via powershell.exe local.
      // `command` est un cmdlet AD pur (ex: Set-ADAccountPassword ...) -> injecté tel quel dans le ScriptBlock.
      const ps = `$sec=ConvertTo-SecureString '${adSvcPw().replace(/'/g, "''")}' -AsPlainText -Force; $cred=New-Object System.Management.Automation.PSCredential('${AD_SVC}',$sec); Invoke-Command -ComputerName ${AD_HOST} -Port ${AD_PORT} -Credential $cred -ScriptBlock { ${command} }`;
      return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 60000, windowsHide: true }, (err, stdout, stderr) => {
          if (err && !stdout) return reject(err);
          resolve({ output: (stdout + stderr).trim(), exitCode: err ? 1 : 0 });
        });
      });
    }
    // Mode soap (Linux/conteneur)
    return winrmRun({ host: AD_HOST, port: AD_PORT, username: AD_SVC, password: adSvcPw() }, command);
  }

  async runAd(action: string, params: Record<string, any>, dryRun?: boolean, actorId?: string): Promise<AdResult> {
    const sam = String(params.samAccountName ?? '').toLowerCase();

    // GARDE-FOU 1 : compte protégé refusé AVANT toute validation de paramètres.
    if (PROTECTED.includes(sam)) {
      const res: AdResult = { ok: false, status: 'failed', error: 'protected account — refused' };
      await this.audit({ action, target: sam, params, status: 'failed', error: res.error, actor_id: actorId });
      return res;
    }

    let command: string;
    try {
      command = psFor(action, params);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const res: AdResult = { ok: false, status: 'failed', error: msg };
      await this.audit({ action, target: sam, params, status: 'failed', error: msg, actor_id: actorId });
      return res;
    }
    const effectiveDry = dryRun ?? !allowRealAd();

    if (effectiveDry || !allowRealAd() || !adSvcPw()) {
      const res: AdResult = { ok: true, status: 'succeeded', dry_run: true, command, note: 'dry-run: non exécuté' };
      await this.audit({ action, target: sam, params, status: 'dry_run', dry_run: true, command, actor_id: actorId });
      return res;
    }

    try {
      const { output, exitCode } = await this.execReal(command);
      const status: 'succeeded' | 'failed' = exitCode === 0 ? 'succeeded' : 'failed';
      const res: AdResult = { ok: exitCode === 0, status, command, output: output.slice(0, 4000) };
      await this.audit({ action, target: sam, params, status, command, output: res.output, actor_id: actorId });
      return res;
    } catch (e: any) {
      const res: AdResult = { ok: false, status: 'failed', command, error: e?.message ?? String(e) };
      await this.audit({ action, target: sam, params, status: 'failed', command, error: res.error, actor_id: actorId });
      return res;
    }
  }
}
