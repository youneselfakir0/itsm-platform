import { Injectable, Logger } from '@nestjs/common';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'itsm@twisterlab.local';
const TEAMS_WEBHOOK = process.env.TEAMS_WEBHOOK;

@Injectable()
export class NotificationService {
  private log = new Logger('NotificationService');

  /** Email via nodemailer (si installé + configuré), sinon log (dry-run). */
  async sendEmail(to: string | string[], subject: string, body: string): Promise<{ ok: boolean; dry_run: boolean; messageId?: string }> {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    if (!SMTP_HOST) {
      this.log.log(`[DRY-RUN] mail to=${recipients} subject="${subject}"`);
      return { ok: true, dry_run: true };
    }
    try {
      // nodemailer chargé dynamiquement pour ne pas bloquer le build si absent
      const nodemailer = await import('nodemailer').then((m) => (m as any).default ?? m).catch(() => null);
      if (!nodemailer) { this.log.log(`[DRY-RUN] nodemailer absent -> mail to=${recipients}`); return { ok: true, dry_run: true }; }
      const t = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      });
      const info = await t.sendMail({ from: SMTP_FROM, to: recipients, subject, text: body });
      return { ok: true, dry_run: false, messageId: info.messageId };
    } catch (e: any) {
      this.log.warn(`email échoué: ${e?.message ?? e}`);
      return { ok: false, dry_run: false };
    }
  }

  /** Notification Teams via webhook (Adaptive Card simple). Résilient. */
  async sendTeams(title: string, text: string, facts?: { name: string; value: string }[]): Promise<{ ok: boolean; dry_run: boolean }> {
    if (!TEAMS_WEBHOOK) {
      this.log.log(`[DRY-RUN] teams: ${title}`);
      return { ok: true, dry_run: true };
    }
    try {
      const card = {
        '@type': 'MessageCard', '@context': 'http://schema.org/extensions',
        themeColor: '0072C6', summary: title,
        sections: [{ activityTitle: title, text, facts: facts || [] }],
      };
      const r = await fetch(TEAMS_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card),
      });
      return { ok: r.ok, dry_run: false };
    } catch (e: any) {
      this.log.warn(`teams échoué: ${e?.message ?? e}`);
      return { ok: false, dry_run: false };
    }
  }

  /** Notif ticket nouvellement créé. */
  ticketCreated(t: { number: number; title: string; priority: string; category?: string; requester_name?: string }) {
    const subject = `[TwisterITSM #${t.number}] Nouveau ticket ${t.priority.toUpperCase()} — ${t.title}`;
    const body = `Ticket #${t.number} créé.\nPriorité: ${t.priority}\nCatégorie: ${t.category ?? 'n/a'}\nDemandeur: ${t.requester_name ?? 'n/a'}\n\n${t.title}`;
    return Promise.all([
      this.sendEmail(process.env.NOTIFY_EMAIL || SMTP_FROM, subject, body),
      this.sendTeams(`Nouveau ticket #${t.number}`, t.title, [
        { name: 'Priorité', value: t.priority }, { name: 'Catégorie', value: t.category ?? 'n/a' }, { name: 'Demandeur', value: t.requester_name ?? 'n/a' },
      ]),
    ]);
  }

  /** Notif SLA breach. */
  slaBreach(t: { number: number; title: string; priority: string; sla_status: string }) {
    const subject = `[TwisterITSM #${t.number}] SLA BREACH (${t.sla_status}) — ${t.title}`;
    const body = `Le ticket #${t.number} a dépassé son SLA (${t.sla_status}).\nPriorité: ${t.priority}\n\n${t.title}`;
    return Promise.all([
      this.sendEmail(process.env.NOTIFY_EMAIL || SMTP_FROM, subject, body),
      this.sendTeams(`⚠️ SLA BREACH #${t.number}`, t.title, [
        { name: 'Priorité', value: t.priority }, { name: 'SLA', value: t.sla_status },
      ]),
    ]);
  }

  /** Notif approbation requise. */
  approvalRequired(req: { id: string; item: string; level: number; kind: string; approver_role?: string }) {
    const subject = `[TwisterITSM] Demande d'approbation (niveau ${req.level}) — ${req.item}`;
    const body = `Une demande catalogue nécessite une approbation.\nArticle: ${req.item}\nNiveau: ${req.level} (${req.kind})\nID demande: ${req.id}`;
    return Promise.all([
      this.sendEmail(process.env.NOTIFY_EMAIL || SMTP_FROM, subject, body),
      this.sendTeams(`🔔 Approbation requise — ${req.item}`, `Niveau ${req.level} (${req.kind})`, [
        { name: 'Article', value: req.item }, { name: 'Niveau', value: String(req.level) },
      ]),
    ]);
  }

  /** Relais d'événement ticket vers TwisterLab (webhook interne, best-effort). */
  async ticketEvent(t: { number: number; event_type: string }): Promise<{ ok: boolean; dry_run: boolean }> {
    const EVENTS_WEBHOOK_URL = process.env.EVENTS_WEBHOOK_URL;
    const EVENTS_WEBHOOK_SECRET = process.env.EVENTS_WEBHOOK_SECRET;
    if (!EVENTS_WEBHOOK_URL) {
      this.log.log(`[DRY-RUN] events: #${t.number} ${t.event_type}`);
      return { ok: true, dry_run: true };
    }
    try {
      const r = await fetch(EVENTS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Events-Key': EVENTS_WEBHOOK_SECRET || '' },
        body: JSON.stringify({ ticket_id: String(t.number), event_type: t.event_type }),
      });
      return { ok: r.ok, dry_run: false };
    } catch (e: any) {
      this.log.warn(`events webhook échoué: ${e?.message ?? e}`);
      return { ok: false, dry_run: false };   // jamais throw
    }
  }
}
