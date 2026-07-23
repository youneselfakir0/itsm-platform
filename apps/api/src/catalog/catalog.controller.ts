import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Permissions } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';

@Controller('catalog')
export class CatalogController {
  constructor(private svc: CatalogService) {}

  @Get('health') health() { return { service: 'catalog', status: 'ok' }; }
  @Permissions('catalog:read') @Get('items') items() { return this.svc.items(); }
  @Permissions('catalog:request') @Post('requests') create(@CurrentUser() u: any, @Body() dto: any) { return this.svc.createRequest(u, dto); }
  @Permissions('catalog:read') @Get('requests') list(@CurrentUser() u: any) { return this.svc.listRequests(u); }
  @Permissions('catalog:approve') @Post('requests/:id/decision')
  decide(@CurrentUser() u: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.decide(u, id, { level: dto.level ?? 1, decision: dto.decision, comment: dto.comment });
  }
}
