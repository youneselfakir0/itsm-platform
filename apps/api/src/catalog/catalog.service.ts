import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { AutomationService } from '../automation/automation.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private automation: AutomationService) {}

  items() { return this.prisma.items.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }

  async createRequest(user: any, dto: { item_id: string; form_data?: any }) {
    const item = await this.prisma.items.findUnique({ where: { id: dto.item_id } });
    if (!item) throw new NotFoundException('unknown item');
    const status = item.requires_approval ? 'pending_approval' : 'approved';
    const req = await this.prisma.requests.create({
      data: { item_id: dto.item_id, requester_id: user.sub, form_data: dto.form_data ?? {}, status },
    });
    if (item.requires_approval) {
      await this.prisma.approvals.create({ data: { request_id: req.id } });
    } else if (item.automation_runbook) {
      await this.automation.createJob(user, { runbook: item.automation_runbook, params: dto.form_data ?? {} });
    }
    return req;
  }

  async listRequests(user: any) {
    const isApprover = user.permissions.includes('catalog:approve') || user.permissions.includes('admin:*');
    return this.prisma.requests.findMany({
      where: isApprover ? {} : { requester_id: user.sub },
      orderBy: { created_at: 'desc' }, take: 100, include: { items: true, approvals: true },
    });
  }

  async decide(user: any, id: string, dto: { decision: string; comment?: string }) {
    const req = await this.prisma.requests.findUnique({ where: { id }, include: { items: true } });
    if (!req) throw new NotFoundException();
    await this.prisma.approvals.updateMany({
      where: { request_id: id },
      data: { approver_id: user.sub, decision: dto.decision, comment: dto.comment, decided_at: new Date() },
    });
    const status = dto.decision === 'approved' ? 'approved' : 'rejected';
    const updated = await this.prisma.requests.update({ where: { id }, data: { status, updated_at: new Date() } });
    if (status === 'approved' && req.items.automation_runbook) {
      await this.automation.createJob(user, { runbook: req.items.automation_runbook, params: req.form_data ?? {} });
    }
    return updated;
  }
}
