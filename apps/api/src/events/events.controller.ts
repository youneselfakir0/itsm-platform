import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { Permissions, Public } from '../core/auth.guard';

@Controller('events')
export class EventsController {
  constructor(private prisma: PrismaService) {}

  @Get('health') health() { return { service: 'events', status: 'ok' }; }

  @Public() @Post('webhook/:source')
  async webhook(@Body() dto: any) {
    const ev = await this.prisma.events.create({
      data: {
        source: dto.source ?? 'unknown', severity: dto.severity ?? 'info',
        subject: dto.subject ?? 'event', payload: dto.payload ?? {}, ci_id: dto.ci_id ?? null,
      },
    });
    return { id: Number(ev.id), correlated: ev.correlated };
  }

  @Permissions('ticket:read') @Get()
  list(@Query('severity') severity?: string) {
    return this.prisma.events.findMany({
      where: severity ? { severity } : {}, orderBy: { at: 'desc' }, take: 100,
    });
  }
}
