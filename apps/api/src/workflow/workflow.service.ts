import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { NotificationService } from '../notifications/notification.service';

interface ApprovalLevel { level: number; kind: string; due_mins: number; }
type Stage = 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'fulfilled';

function minsFromNow(m: number) { return new Date(Date.now() + m * 60_000); }

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService, private notif?: NotificationService) {}

  /** Date d'échéance SLA pour une priorité donnée. */
  async slaDue(priority: string) {
    const pol = await this.prisma.sla_policies.findFirst({ where: { priority } });
    if (!pol) return null;
    return {
      policy: pol.name,
      response_due_at: minsFromNow(pol.response_mins),
      resolution_due_at: minsFromNow(pol.resolution_mins),
    };
  }

  /** Attache un workflow + SLA à un ticket à la création. */
  async attachToTicket(ticketId: string, priority: string) {
    const pol = await this.prisma.sla_policies.findFirst({ where: { priority } });
    if (!pol) return;
    await this.prisma.tickets.update({
      where: { id: ticketId },
      data: {
        sla_policy_id: pol.id,
        sla_response_due_at: minsFromNow(pol.response_mins),
        sla_resolution_due_at: minsFromNow(pol.resolution_mins),
        sla_status: 'ok',
      },
    });
  }

  /** Démarre le workflow d'une demande catalogue. */
  async startForRequest(requestId: string, itemId: string) {
    const item = await this.prisma.items.findUnique({ where: { id: itemId } });
    const wf = await this.prisma.workflows.findFirst({ where: { entity: 'request', active: true } });
    if (!wf) {
      await this.prisma.requests.update({ where: { id: requestId }, data: { current_stage: 'approved' } });
      return { stage: 'approved', approvals: [] as any[] };
    }
    const levels: ApprovalLevel[] = ((wf.approval_levels as unknown) as ApprovalLevel[]) ?? [];
    const req = await this.prisma.requests.update({
      where: { id: requestId },
      data: { workflow_id: wf.id, current_stage: levels.length ? 'pending_approval' : 'approved' },
    });
    const created: any[] = [];
    if (levels.length) {
      for (const lvl of levels) {
        const a = await this.prisma.approvals.create({
          data: { request_id: requestId, level: lvl.level, kind: lvl.kind, due_at: minsFromNow(lvl.due_mins) },
        });
        created.push(a);
      }
    } else if (item?.automation_runbook) {
      // pas d'approbation -> exécution directe (délégué au catalog)
    }
    return { stage: req.current_stage, approvals: created };
  }

  /** Décide un niveau d'approbation ; avance le workflow. */
  async decide(user: any, requestId: string, level: number, decision: 'approved' | 'rejected', comment?: string) {
    const req = await this.prisma.requests.findUnique({ where: { id: requestId }, include: { approvals: { orderBy: { level: 'asc' } } } });
    if (!req) throw new NotFoundException('request introuvable');
    const lvl = req.approvals.find((a) => a.level === level);
    if (!lvl) throw new NotFoundException(`niveau ${level} introuvable`);
    if (lvl.decision) throw new NotFoundException(`niveau ${level} déjà décidé`);
    await this.prisma.approvals.update({
      where: { id: lvl.id },
      data: { approver_id: user.sub, decision, comment, decided_at: new Date() },
    });

    if (decision === 'rejected') {
      await this.prisma.requests.update({ where: { id: requestId }, data: { current_stage: 'rejected', status: 'rejected' } });
      return { stage: 'rejected' };
    }
    const remaining = req.approvals.filter((a) => a.level !== level && !a.decision);
    if (remaining.length) {
      await this.prisma.requests.update({ where: { id: requestId }, data: { current_stage: 'pending_approval' } });
      const item = await this.prisma.items.findUnique({ where: { id: req.item_id } });
      const notif = (this as any).notif as NotificationService | undefined;
      if (notif) notif.approvalRequired({ id: requestId, item: item?.name ?? 'demande', level: remaining[0].level, kind: remaining[0].kind }).catch?.(() => {});
      return { stage: 'pending_approval', waiting_level: remaining[0].level };
    }
    const updated = await this.prisma.requests.update({ where: { id: requestId }, data: { current_stage: 'approved', status: 'approved' } });
    return { stage: 'approved', request: updated };
  }

  /** Liste des politiques SLA. */
  listPolicies() { return this.prisma.sla_policies.findMany({ orderBy: { priority: 'asc' } }); }

  /** Liste des définitions de workflow actives. */
  listDefinitions() { return this.prisma.workflows.findMany({ where: { active: true } }); }

  /** Recalcul le statut SLA des tickets et applique l'escalade si breach. */
  async evaluateSla(): Promise<{ breached: number; escalated: number }> {
    const now = new Date();
    let breached = 0, escalated = 0;
    const open = await this.prisma.tickets.findMany({
      where: { status: { notIn: ['resolved', 'closed'] }, OR: [{ sla_resolution_due_at: { lt: now } }, { sla_response_due_at: { lt: now } }] },
    });
    for (const t of open) {
      breached++;
      const status = t.sla_resolution_due_at && t.sla_resolution_due_at < now ? 'breached_resolution'
        : t.sla_response_due_at && t.sla_response_due_at < now ? 'breached_response' : t.sla_status;
      let escalatedAt = t.escalated_at;
      if (status !== t.sla_status && !t.escalated_at) {
        escalatedAt = now; escalated++;
        const notif = (this as any).notif as NotificationService | undefined;
        if (notif) notif.slaBreach({ number: Number(t.number), title: t.title, priority: t.priority, sla_status: status }).catch?.(() => {});
      }
      await this.prisma.tickets.update({ where: { id: t.id }, data: { sla_status: status, escalated_at: escalatedAt } });
    }
    return { breached, escalated };
  }
}
