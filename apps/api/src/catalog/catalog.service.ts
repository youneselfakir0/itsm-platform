import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { AutomationService } from '../automation/automation.service';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private automation: AutomationService, private wf: WorkflowService) {}

  items() { return this.prisma.items.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }

  async createRequest(user: any, dto: { item_id: string; form_data?: any }) {
    const item = await this.prisma.items.findUnique({ where: { id: dto.item_id } });
    if (!item) throw new NotFoundException('unknown item');
    const req = await this.prisma.requests.create({
      data: { item_id: dto.item_id, requester_id: user.sub, form_data: dto.form_data ?? {}, status: 'submitted', current_stage: 'submitted' },
    });
    // Délègue au Workflow Engine (approbations multi-niveaux + SLA)
    const started = await this.wf.startForRequest(req.id, dto.item_id);
    // Si approuvé direct (pas de niveaux) et runbook -> exécution auto
    if (started.stage === 'approved' && item.automation_runbook) {
      await this.automation.createJob(user, { runbook: item.automation_runbook, params: dto.form_data ?? {} });
    }
    return { ...req, stage: started.stage, approvals: started.approvals };
  }

  async listRequests(user: any) {
    const isApprover = user.permissions.includes('catalog:approve') || user.permissions.includes('admin:*');
    return this.prisma.requests.findMany({
      where: isApprover ? {} : { requester_id: user.sub },
      orderBy: { created_at: 'desc' }, take: 100, include: { items: true, approvals: true },
    });
  }

  /** Décide un niveau d'approbation (délégué au Workflow Engine). */
  decide(user: any, id: string, dto: { level: number; decision: string; comment?: string }) {
    return this.wf.decide(user, id, dto.level, dto.decision as any, dto.comment);
  }
}
