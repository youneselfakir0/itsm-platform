import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { Permissions, Public } from '../core/auth.guard';

@Controller('events')
export class EventsController {
  constructor(private prisma: PrismaService) {}

  @Get('health') health() { return { service: 'events', status: 'ok' }; }

  @Public() @Post('webhook/:source')
  async webhook(@Body() dto: any) {
    const ciId = await this.matchCi(dto);
    const ev = await this.prisma.events.create({
      data: {
        source: dto.source ?? 'unknown', severity: dto.severity ?? 'info',
        subject: dto.subject ?? 'event', payload: dto.payload ?? {}, ci_id: ciId,
      },
    });
    return { id: Number(ev.id), correlated: !!ciId, ci_id: ciId };
  }

  @Permissions('ticket:read') @Get()
  list(@Query('severity') severity?: string) {
    return this.prisma.events.findMany({
      where: severity ? { severity } : {}, orderBy: { at: 'desc' }, take: 100,
    });
  }

  /** Corrèle un event existant à un CI par nom (subject ou payload.host). */
  @Permissions('ticket:read') @Post(':id/correlate')
  async correlate(@Param('id') id: string) {
    const ev = await this.prisma.events.findUnique({ where: { id: BigInt(id) } });
    if (!ev) return { error: 'not found' };
    const ciId = await this.matchCi(ev);
    await this.prisma.events.update({ where: { id: ev.id }, data: { ci_id: ciId, correlated: !!ciId } });
    return { id: Number(ev.id), ci_id: ciId, correlated: !!ciId };
  }

  /** Recherche un CI dont le nom matche le subject ou payload.host. */
  private async matchCi(ev: { subject?: string; payload?: any }): Promise<string | null> {
    const candidates: string[] = [];
    if (ev.subject) candidates.push(ev.subject);
    if (ev.payload?.host) candidates.push(ev.payload.host);
    if (ev.payload?.hostname) candidates.push(ev.payload.hostname);
    if (ev.payload?.ci) candidates.push(ev.payload.ci);
    for (const c of candidates.filter(Boolean)) {
      const ci = await this.prisma.cis.findFirst({ where: { name: { equals: c, mode: 'insensitive' } } });
      if (ci) return ci.id;
    }
    return null;
  }
}
