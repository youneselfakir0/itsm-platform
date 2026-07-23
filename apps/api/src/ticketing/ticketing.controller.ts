import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TicketingService } from './ticketing.service';
import { Permissions } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtUser } from '../core/auth.guard';

@Controller('tickets')
export class TicketingController {
  constructor(private svc: TicketingService) {}

  @Get('health')
  health() { return { service: 'ticketing', status: 'ok' }; }

  @Permissions('ticket:write') @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: any) { return this.svc.create(user, dto); }

  @Permissions('ticket:read') @Get()
  list(@CurrentUser() user: JwtUser, @Query() q: any) { return this.svc.list(user, q); }

  @Permissions('ticket:read') @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.svc.get(user, id); }

  @Permissions('ticket:write') @Patch(':id')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: any) { return this.svc.update(user, id, dto); }

  @Permissions('ticket:write') @Post(':id/comments')
  comment(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: any) { return this.svc.addComment(user, id, dto); }
}
