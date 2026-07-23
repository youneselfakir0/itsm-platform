import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CmdbService } from './cmdb.service';
import { Permissions } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';

@Controller('cmdb')
export class CmdbController {
  constructor(private svc: CmdbService) {}

  @Get('health') health() { return { service: 'cmdb', status: 'ok' }; }

  @Permissions('ci:read') @Get('classes') classes() { return this.svc.classes(); }
  @Permissions('ci:read') @Get('cis') list(@Query() q: any) { return this.svc.listCis(q); }
  @Permissions('ci:write') @Post('cis') create(@CurrentUser() u: any, @Body() dto: any) { return this.svc.createCi(u, dto); }
  @Permissions('ci:read') @Get('cis/:id') get(@Param('id') id: string) { return this.svc.getCi(id); }
  @Permissions('ci:write') @Patch('cis/:id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.updateCi(id, dto); }
  @Permissions('ci:write') @Post('relations') rel(@Body() dto: any) { return this.svc.createRelation(dto); }
}
