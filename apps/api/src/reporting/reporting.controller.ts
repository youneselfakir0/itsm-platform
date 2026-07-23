import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { Permissions } from '../core/auth.guard';

@Controller('reports')
export class ReportingController {
  constructor(private prisma: PrismaService) {}

  @Permissions('report:read') @Get('overview')
  async overview() {
    const [total, byStatus, byPriority, cis, jobs] = await Promise.all([
      this.prisma.tickets.count(),
      this.prisma.tickets.groupBy({ by: ['status'], _count: true }),
      this.prisma.tickets.groupBy({ by: ['priority'], _count: true }),
      this.prisma.cis.count(),
      this.prisma.jobs.count(),
    ]);
    const resolved = await this.prisma.tickets.findMany({
      where: { resolved_at: { not: null } }, select: { created_at: true, resolved_at: true }, take: 500,
    });
    const mttrMs = resolved.length
      ? resolved.reduce((s, t) => s + (t.resolved_at!.getTime() - t.created_at.getTime()), 0) / resolved.length
      : 0;
    return {
      tickets: total,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      by_priority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count])),
      cmdb_cis: cis, automation_jobs: jobs,
      mttr_hours: Math.round((mttrMs / 36e5) * 10) / 10,
    };
  }
}
