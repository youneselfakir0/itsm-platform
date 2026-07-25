import { WorkflowService } from './workflow.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * Mock Prisma flexible : chaque modèle expose des méthodes jest.fn() configurables
 * par test. Les valeurs retournées sont surchargeables via `set`.
 */
function makeMockPrisma(state: any = {}) {
  const db: any = {
    tickets: {
      findMany: jest.fn(),
      update: jest.fn(async (a: any) => a.data),
    },
    sla_policies: { findFirst: jest.fn(), findMany: jest.fn() },
    requests: {
      findUnique: jest.fn(),
      update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })),
    },
    items: { findUnique: jest.fn() },
    workflows: { findFirst: jest.fn(), findMany: jest.fn() },
    approvals: {
      create: jest.fn(async (a: any) => ({ id: 'ap-' + a.data.level, ...a.data })),
      find: jest.fn(),
      update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })),
    },
    job_logs: { create: jest.fn() },
  };
  // Applique l'état pré-rempli
  for (const [k, v] of Object.entries(state)) {
    const [model, method] = k.split('.');
    if (db[model] && db[model][method]) db[model][method].mockResolvedValue(v);
  }
  return db as any;
}

describe('WorkflowService — SLA', () => {
  it('calcule les échéances SLA à partir de la politique de priorité', async () => {
    const prisma = makeMockPrisma({
      'sla_policies.findFirst': { name: 'P1', response_mins: 15, resolution_mins: 240 },
    });
    const svc = new WorkflowService(prisma);
    const due = await svc.slaDue('P1');
    expect(due?.policy).toBe('P1');
    expect(due?.response_due_at).toBeInstanceOf(Date);
    expect(due?.resolution_due_at).toBeInstanceOf(Date);
  });

  it('renvoie null si aucune politique ne correspond', async () => {
    const prisma = makeMockPrisma({ 'sla_policies.findFirst': null });
    const svc = new WorkflowService(prisma);
    expect(await svc.slaDue('ZZ')).toBeNull();
  });

  it('evaluateSla détecte un breach et déclenche l\'escalade une seule fois (idempotent)', async () => {
    const past = new Date(Date.now() - 60_000);
    const ticket = () => ({
      id: 't1', number: 42, title: 'Down', priority: 'P1',
      sla_status: 'ok', escalated_at: null,
      sla_response_due_at: past, sla_resolution_due_at: past,
    });
    const prisma = makeMockPrisma({});
    // 1er passage : ticket non encore escaladé ; 2e passage : déjà escaladé.
    prisma.tickets.findMany
      .mockResolvedValueOnce([ticket()])
      .mockResolvedValueOnce([{ ...ticket(), escalated_at: new Date() }]);
    const notif = { slaBreach: jest.fn().mockResolvedValue(undefined) } as any;
    const svc = new WorkflowService(prisma, notif);

    const r1 = await svc.evaluateSla();
    expect(r1.breached).toBe(1);
    expect(r1.escalated).toBe(1);
    expect(prisma.tickets.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sla_status: 'breached_resolution', escalated_at: expect.any(Date) }) }),
    );
    expect(notif.slaBreach).toHaveBeenCalledTimes(1);

    // Rejouer : le ticket est déjà escaladé -> ne double-pas l'escalade
    const r2 = await svc.evaluateSla();
    expect(r2.breached).toBe(1);
    expect(r2.escalated).toBe(0);
    expect(notif.slaBreach).toHaveBeenCalledTimes(1); // pas de 2e notif
  });

  it('evaluateSla ne touche pas aux tickets en cours (non breach)', async () => {
    const prisma = makeMockPrisma({ 'tickets.findMany': [] });
    const svc = new WorkflowService(prisma);
    const r = await svc.evaluateSla();
    expect(r.breached).toBe(0);
    expect(r.escalated).toBe(0);
    expect(prisma.tickets.update).not.toHaveBeenCalled();
  });
});

describe('WorkflowService — approbations multi-niveaux', () => {
  it('startForRequest sans workflow actif => approuvé direct', async () => {
    const prisma = makeMockPrisma({ 'workflows.findFirst': null });
    const svc = new WorkflowService(prisma);
    const res = await svc.startForRequest('req-1', 'item-1');
    expect(res.stage).toBe('approved');
    expect(res.approvals).toEqual([]);
  });

  it('startForRequest avec 1 niveau => pending_approval + 1 approval créée', async () => {
    const prisma = makeMockPrisma({
      'workflows.findFirst': { id: 'wf1', approval_levels: [{ level: 1, kind: 'role:admin', due_mins: 60 }] },
      'items.findUnique': { id: 'item-1', name: 'Nouveau laptop' },
    });
    const svc = new WorkflowService(prisma);
    const res = await svc.startForRequest('req-1', 'item-1');
    expect(res.stage).toBe('pending_approval');
    expect(res.approvals).toHaveLength(1);
    expect(prisma.approvals.create).toHaveBeenCalledTimes(1);
  });

  it('decide rejette => stage rejected', async () => {
    const prisma = makeMockPrisma({
      'requests.findUnique': { id: 'req-1', item_id: 'item-1', approvals: [{ id: 'a1', level: 1, decision: null }] },
    });
    const svc = new WorkflowService(prisma);
    const res = await svc.decide({ sub: 'u1' }, 'req-1', 1, 'rejected', 'nope');
    expect(res.stage).toBe('rejected');
    expect(prisma.requests.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ current_stage: 'rejected', status: 'rejected' }) }),
    );
  });

  it('decide dernier niveau approuvé => stage approved', async () => {
    const prisma = makeMockPrisma({
      'requests.findUnique': { id: 'req-1', item_id: 'item-1', approvals: [{ id: 'a1', level: 1, decision: null }] },
      'items.findUnique': { id: 'item-1', name: 'Laptop' },
    });
    const notif = { approvalRequired: jest.fn().mockResolvedValue(undefined) } as any;
    const svc = new WorkflowService(prisma, notif);
    const res = await svc.decide({ sub: 'u1' }, 'req-1', 1, 'approved');
    expect(res.stage).toBe('approved');
    expect(notif.approvalRequired).not.toHaveBeenCalled(); // plus de niveau en attente
  });

  it('decide niveau intermédiaire => reste pending_approval + notif niveau suivant', async () => {
    const prisma = makeMockPrisma({
      'requests.findUnique': {
        id: 'req-1', item_id: 'item-1',
        approvals: [
          { id: 'a1', level: 1, decision: null },
          { id: 'a2', level: 2, decision: null },
        ],
      },
      'items.findUnique': { id: 'item-1', name: 'Laptop' },
    });
    const notif = { approvalRequired: jest.fn().mockResolvedValue(undefined) } as any;
    const svc = new WorkflowService(prisma, notif);
    const res = await svc.decide({ sub: 'u1' }, 'req-1', 1, 'approved');
    expect(res.stage).toBe('pending_approval');
    expect(res.waiting_level).toBe(2);
    expect(notif.approvalRequired).toHaveBeenCalledTimes(1);
  });

  it('decide sur un niveau déjà décidé => erreur (idempotence décision)', async () => {
    const prisma = makeMockPrisma({
      'requests.findUnique': { id: 'req-1', item_id: 'item-1', approvals: [{ id: 'a1', level: 1, decision: 'approved', decided_at: new Date() }] },
    });
    const svc = new WorkflowService(prisma);
    await expect(svc.decide({ sub: 'u1' }, 'req-1', 1, 'approved')).rejects.toThrow();
  });
});
