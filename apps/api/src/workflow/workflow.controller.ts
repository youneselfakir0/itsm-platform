import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { Permissions } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtUser } from '../core/auth.guard';

@Controller('workflow')
export class WorkflowController {
  constructor(private svc: WorkflowService) {}

  @Get('health') health() { return { service: 'workflow', status: 'ok' }; }

  @Permissions('workflow:read') @Get('sla-policies')
  policies() { return this.svc.listPolicies(); }

  @Permissions('workflow:read') @Get('definitions')
  defs() { return this.svc.listDefinitions(); }

  @Permissions('workflow:run') @Post('evaluate-sla')
  evaluate() { return this.svc.evaluateSla(); }

  @Permissions('catalog:approve') @Post('requests/:id/approve')
  approve(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: { level: number; decision: string; comment?: string }) {
    return this.svc.decide(u, id, dto.level, dto.decision as any, dto.comment);
  }
}
