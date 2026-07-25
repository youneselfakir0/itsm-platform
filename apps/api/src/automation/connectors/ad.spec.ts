import { AdConnector } from './ad';

// Mock du client WinRM : la voie réelle n'ouvre pas de connexion réseau en test.
jest.mock('./winrm-client', () => ({
  winrmRun: jest.fn(),
}));

/**
 * Mock Prisma minimal : ne fait qu'enregistrer les appels `ad_executions.create`
 * pour vérifier que CHAQUE tentative (succès, échec, dry-run) est auditée.
 */
function makeMockPrisma() {
  const executions: any[] = [];
  return {
    executions,
    prisma: {
      ad_executions: {
        create: jest.fn(async (row: any) => {
          executions.push(row.data);
          return row.data;
        }),
      },
    } as any,
  };
}

describe('AdConnector', () => {
  it('refuse une action sur un compte protégé (administrator)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res = await ad.runAd('reset_password', { samAccountName: 'administrator' }, true);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/protected account/i);
    expect(executions.some((e) => e.status === 'failed' && e.target === 'administrator')).toBe(true);
  });

  it('refuse une action sur un compte protégé (krbtgt)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res = await ad.runAd('disable_user', { samAccountName: 'KrBtGt' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('failed');
    expect(executions[0].target).toBe('krbtgt');
  });

  it('renvoie dry_run=true par défaut (ALLOW_REAL_AD non activé)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res = await ad.runAd('disable_user', { samAccountName: 'jdoe' });
    expect(res.dry_run).toBe(true);
    expect(res.status).toBe('succeeded');
    expect(executions[0].dry_run).toBe(true);
    expect(executions[0].status).toBe('dry_run');
  });

  it('échoue explicitement si newPassword absent pour reset_password (non-régression 1.5)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res: any = await ad.runAd('reset_password', { samAccountName: 'jdoe' }, true);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/newPassword requis/i);
    expect(executions[0].status).toBe('failed');
    // Le fallback prévisible ne doit SURTOUT PAS avoir été utilisé
    expect(res.command ?? '').not.toMatch(/ChangeMe123!/);
  });

  it('échoue explicitement si newPassword absent pour create_user (non-régression 1.5)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res: any = await ad.runAd('create_user', { samAccountName: 'jdoe' }, true);
    expect(res.ok).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/newPassword requis/i);
    expect(executions[0].status).toBe('failed');
  });

  it('génère la commande cmdlet pour reset_password avec un vrai mot de passe (dry-run)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    const res: any = await ad.runAd('reset_password', { samAccountName: 'jdoe', newPassword: 'S3cret!New' }, true);
    expect(res.dry_run).toBe(true);
    expect(res.command).toContain('Set-ADAccountPassword');
    expect(res.command).toContain('S3cret!New');
    expect(res.command).not.toContain('ChangeMe123!');
    expect(executions[0].status).toBe('dry_run');
  });

  it('écrit une ligne d\'audit pour chaque tentative (succès dry-run)', async () => {
    const { prisma, executions } = makeMockPrisma();
    const ad = new AdConnector(prisma);
    await ad.runAd('disable_user', { samAccountName: 'jdoe' }, true, 'actor-123');
    expect(executions.length).toBe(1);
    expect(executions[0].actor_id).toBe('actor-123');
    expect(executions[0].action).toBe('disable_user');
  });

  it('exécute réellement via winrmRun quand ALLOW_REAL_AD=1 et SVC_PW défini', async () => {
    // Activer la voie réelle AVANT de (re)charger le module (config lue à l'appel).
    process.env.ALLOW_REAL_AD = '1';
    process.env.AD_SVC_PW = 'svc-pw';
    process.env.AD_SVC = 'twisterlab.local\\svc-itsm';
    process.env.AD_HOST = '192.168.0.20';
    process.env.AD_PORT = '5985';
    jest.resetModules();
    const { AdConnector: RealAd } = require('./ad');
    const winrm = require('./winrm-client');
    (winrm.winrmRun as jest.Mock).mockResolvedValue({ output: 'OK', exitCode: 0 });
    const { prisma, executions } = makeMockPrisma();
    const ad = new RealAd(prisma);
    const res = await ad.runAd('disable_user', { samAccountName: 'jdoe' });
    expect((winrm.winrmRun as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect(res.ok).toBe(true);
    expect(res.status).toBe('succeeded');
    expect(executions[0].status).toBe('succeeded');
    delete process.env.ALLOW_REAL_AD;
    delete process.env.AD_SVC_PW;
  });
});
