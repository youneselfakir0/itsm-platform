import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { JwtUser } from '../core/auth.guard';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationService } from '../notifications/notification.service';

const DETAIL_FIELDS = [
  'is_existing', 'related_ticket_number', 'first_seen_on', 'users_affected',
  'error_message', 'asset_tag', 'callback_number',
  'troubleshooting', 'root_cause', 'resolution_notes', 'kb_article',
] as const;

@Injectable()
export class TicketingService {
  constructor(private prisma: PrismaService, private wf?: WorkflowService, private notif?: NotificationService) {}

  private async names(ids: string[]): Promise<Record<string, string>> {
    const clean = [...new Set(ids.filter(Boolean))];
    if (!clean.length) return {};
    const rows = await this.prisma.users.findMany({ where: { id: { in: clean } }, select: { id: true, display_name: true } });
    return Object.fromEntries(rows.map((u) => [u.id, u.display_name]));
  }

  async create(user: JwtUser, dto: any) {
    const data: any = {
      type: dto.type ?? 'incident',
      title: dto.title,
      description: dto.description,
      priority: dto.priority ?? 'p3',
      category: dto.category,
      requester_id: user.sub,
    };
    for (const k of DETAIL_FIELDS) {
      if (dto[k] !== undefined && dto[k] !== '') {
        data[k] = k === 'first_seen_on' ? new Date(dto[k])
          : k === 'related_ticket_number' ? BigInt(dto[k])
          : dto[k];
      }
    }
    const created = await this.prisma.tickets.create({ data });
    // SLA : attache la politique selon la priorité
    const wf = (this as any).wf as WorkflowService | undefined;
    if (wf) await wf.attachToTicket(created.id, created.priority);
    // Notification : nouveau ticket (fire-and-forget)
    const notif = (this as any).notif as NotificationService | undefined;
    if (notif) notif.ticketCreated({ number: Number(created.number), title: created.title, priority: created.priority, category: created.category ?? undefined, requester_name: user.sub }).catch?.(() => {});
    notif.ticketEvent({ number: Number(created.number), event_type: 'created' }).catch?.(() => {});
    return created;
  }

  async list(user: JwtUser, q: { status?: string; mine?: string; limit?: string }) {
    const isTech = user.permissions.includes('ticket:assign') || user.permissions.includes('admin:*');
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.mine === 'true' || !isTech) where.requester_id = user.sub;
    const rows = await this.prisma.tickets.findMany({
      where, orderBy: { created_at: 'desc' }, take: Math.min(Number(q.limit || 50), 200),
    });
    const nmeta = await this.names(rows.flatMap((t) => [t.requester_id, t.assignee_id].filter(Boolean) as string[]));
    return rows.map((t) => ({ ...t, requester_name: nmeta[t.requester_id] ?? null, assignee_name: t.assignee_id ? nmeta[t.assignee_id] : null }));
  }

  async get(_user: JwtUser, id: string) {
    const t = await this.prisma.tickets.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    const comments = await this.prisma.ticket_comments.findMany({ where: { ticket_id: id }, orderBy: { created_at: 'asc' } });
    const history = await this.prisma.ticket_history.findMany({ where: { ticket_id: id }, orderBy: { at: 'asc' } });
    const nmeta = await this.names([
      t.requester_id, t.assignee_id as string,
      ...comments.map((c) => c.author_id),
      ...history.map((h) => h.actor_id).filter(Boolean) as string[],
    ]);
    return {
      ...t,
      requester_name: nmeta[t.requester_id] ?? null,
      assignee_name: t.assignee_id ? nmeta[t.assignee_id] : null,
      comments: comments.map((c) => ({ ...c, author_name: nmeta[c.author_id] ?? null })),
      history: history.map((h) => ({ ...h, actor_name: h.actor_id ? nmeta[h.actor_id] : null })),
    };
  }

  async update(user: JwtUser, id: string, dto: any) {
    const before = await this.prisma.tickets.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const allowed = ['status', 'priority', 'assignee_id', 'category', 'title', 'description', ...DETAIL_FIELDS];
    const data: any = {};
    for (const k of allowed) {
      if (dto[k] !== undefined) {
        data[k] = k === 'first_seen_on' ? new Date(dto[k])
          : k === 'related_ticket_number' ? BigInt(dto[k])
          : dto[k];
      }
    }
    if (dto.status === 'resolved') data.resolved_at = new Date();
    data.updated_at = new Date();
    const updated = await this.prisma.tickets.update({ where: { id }, data });
    // Relais événement vers TwisterLab (Option C, piste 2) — best-effort
    const notif = (this as any).notif as NotificationService | undefined;
    if (notif) notif.ticketEvent({ number: Number(updated.number), event_type: dto.status === 'resolved' ? 'resolved' : 'status_changed' }).catch?.(() => {});
    // audit applicatif AVEC acteur — qui a changé quoi
    const logs = allowed
      .filter((k) => dto[k] !== undefined && String((before as any)[k] ?? '') !== String(dto[k] ?? ''))
      .map((k) => ({ ticket_id: id, actor_id: user.sub, field: k, old_value: (before as any)[k] == null ? null : String((before as any)[k]), new_value: String(dto[k]) }));
    if (logs.length) await this.prisma.ticket_history.createMany({ data: logs });
    return updated;
  }

  async addComment(user: JwtUser, id: string, dto: { body: string; internal?: boolean }) {
    const t = await this.prisma.tickets.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    return this.prisma.ticket_comments.create({ data: { ticket_id: id, author_id: user.sub, body: dto.body, internal: !!dto.internal } });
  }
}
