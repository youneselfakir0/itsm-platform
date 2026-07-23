import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { Permissions } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';

@Controller('automation')
export class AutomationController {
  constructor(private svc: AutomationService) {}

  @Get('health') health() { return { service: 'automation', status: 'ok' }; }
  @Permissions('automation:read') @Get('runbooks') runbooks() { return this.svc.runbooks(); }
  @Permissions('automation:run') @Post('jobs') create(@CurrentUser() u: any, @Body() dto: any) { return this.svc.createJob(u, dto); }
  @Permissions('automation:read') @Get('jobs') jobs() { return this.svc.jobs(); }
  @Permissions('automation:read') @Get('jobs/:id') job(@Param('id') id: string) { return this.svc.getJob(id); }
}
