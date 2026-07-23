import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DbService } from './db.service';

interface JwtUser { sub: string; role: string; permissions: string[] }

@Injectable()
export class TicketsService {
  constructor(private db: DbService) {}

  private can(user: JwtUser, perm: string) {
    if (!user.permissions?.includes(perm) && !user.permissions?.includes('admin:*')) {
      throw new ForbiddenException(`missing permission ${perm}`);
    }
  }

  async create(user: JwtUser, dto: { type?: string; title: string; description?: string; priority?: string; category?: string }) {
    this.can(user, 'ticket:write');
    const r = await this.db.query(
      `INSERT INTO ticketing.tickets (type, title, description, priority, category, requester_id)
       VALUES (COALESCE($1,'incident'), $2, $3, COALESCE($4,'p3'), $5, $6)
       RETURNING *`,
      [dto.type, dto.title, dto.description, dto.priority, dto.category, user.sub],
    );
    // TODO P2: publish ticket.created sur NATS
    return r.rows[0];
  }

  async list(user: JwtUser, q: { status?: string; mine?: string; limit?: string }) {
    this.can(user, 'ticket:read');
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (q.status) { params.push(q.status); where += ` AND t.status = $${params.length}`; }
    const isTech = user.permissions.includes('ticket:assign') || user.permissions.includes('admin:*');
    if (q.mine === 'true' || !isTech) { params.push(user.sub); where += ` AND t.requester_id = $${params.length}`; }
    params.push(Math.min(Number(q.limit || 50), 200));
    const r = await this.db.query(
      `SELECT t.*, req.display_name AS requester_name, asg.display_name AS assignee_name
       FROM ticketing.tickets t
       LEFT JOIN users.users req ON req.id = t.requester_id
       LEFT JOIN users.users asg ON asg.id = t.assignee_id
       ${where} ORDER BY t.created_at DESC LIMIT $${params.length}`,
      params,
    );
    return r.rows;
  }

  async get(user: JwtUser, id: string) {
    this.can(user, 'ticket:read');
    const t = await this.db.query(
      `SELECT t.*, req.display_name AS requester_name, asg.display_name AS assignee_name
       FROM ticketing.tickets t
       LEFT JOIN users.users req ON req.id = t.requester_id
       LEFT JOIN users.users asg ON asg.id = t.assignee_id
       WHERE t.id=$1`, [id]);
    if (!t.rows[0]) throw new NotFoundException();
    const comments = await this.db.query(
      `SELECT c.*, u.display_name AS author_name
       FROM ticketing.ticket_comments c LEFT JOIN users.users u ON u.id = c.author_id
       WHERE c.ticket_id=$1 ORDER BY c.created_at`, [id]);
    const history = await this.db.query(
      `SELECT h.*, u.display_name AS actor_name
       FROM ticketing.ticket_history h LEFT JOIN users.users u ON u.id = h.actor_id
       WHERE h.ticket_id=$1 ORDER BY h.at`, [id]);
    return { ...t.rows[0], comments: comments.rows, history: history.rows };
  }

  async update(user: JwtUser, id: string, dto: Partial<{ status: string; priority: string; assignee_id: string; category: string; title: string; description: string }>) {
    this.can(user, dto.assignee_id !== undefined ? 'ticket:assign' : 'ticket:write');
    const before = (await this.db.query(`SELECT * FROM ticketing.tickets WHERE id=$1`, [id])).rows[0];
    if (!before) throw new NotFoundException();
    const allowed = ['status', 'priority', 'assignee_id', 'category', 'title', 'description'] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const k of allowed) {
      if (dto[k] !== undefined) { params.push(dto[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (!sets.length) return this.get(user, id);
    if (dto.status === 'resolved') sets.push(`resolved_at = now()`);
    params.push(id);
    const r = await this.db.query(
      `UPDATE ticketing.tickets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    // audit applicatif AVEC acteur — qui a changé quoi
    for (const k of allowed) {
      if (dto[k] !== undefined && String(before[k] ?? '') !== String(dto[k] ?? '')) {
        await this.db.query(
          `INSERT INTO ticketing.ticket_history (ticket_id, actor_id, field, old_value, new_value)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, user.sub, k, before[k] == null ? null : String(before[k]), String(dto[k])],
        );
      }
    }
    return r.rows[0];
  }

  async comment(user: JwtUser, id: string, body: string, internal = false) {
    this.can(user, 'ticket:write');
    const r = await this.db.query(
      `INSERT INTO ticketing.ticket_comments (ticket_id, author_id, body, internal)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, user.sub, body, internal],
    );
    return r.rows[0];
  }
}
