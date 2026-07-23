import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { runAd } from './connectors/ad';

@Injectable()
export class AutomationService {
  constructor(private prisma: PrismaService) {}

  runbooks() { return this.prisma.runbooks.findMany({ orderBy: { name: 'asc' } }); }

  async createJob(user: any, dto: { runbook: string; params?: any; dry_run?: boolean }) {
    const rb = await this.prisma.runbooks.findUnique({ where: { name: dto.runbook } });
    if (!rb) throw new NotFoundException(`unknown runbook ${dto.runbook}`);
    const dryRun = dto.dry_run ?? rb.dry_run_default;
    const job = await this.prisma.jobs.create({
      data: { runbook_id: rb.id, requested_by: user.sub, params: dto.params ?? {}, dry_run: dryRun, status: 'running', started_at: new Date() },
    });
    let result: any;
    if (rb.connector === 'ad') result = await runAd(rb.action, dto.params ?? {}, dryRun);
    else result = { ok: true, status: 'succeeded', note: `connector ${rb.connector} simulé`, dry_run: dryRun };

    const updated = await this.prisma.jobs.update({
      where: { id: job.id },
      data: { status: result.status, result, finished_at: new Date() },
    });
    await this.prisma.job_logs.create({ data: { job_id: job.id, message: result.command ?? result.note ?? result.status } });
    return updated;
  }

  async getJob(id: string) {
    const job = await this.prisma.jobs.findUnique({ where: { id }, include: { job_logs: true } });
    if (!job) throw new NotFoundException();
    return job;
  }

  jobs() { return this.prisma.jobs.findMany({ orderBy: { created_at: 'desc' }, take: 100 }); }
}
