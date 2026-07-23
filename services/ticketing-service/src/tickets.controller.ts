import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Public } from './jwt.guard';

@Controller()
export class TicketsController {
  constructor(private svc: TicketsService) {}

  @Public()
  @Get('health')
  health() {
    return { service: 'ticketing-service', status: 'ok' };
  }

  @Post('tickets')
  create(@Req() req: any, @Body() dto: any) {
    return this.svc.create(req.user, dto);
  }

  @Get('tickets')
  list(@Req() req: any, @Query() q: any) {
    return this.svc.list(req.user, q);
  }

  @Get('tickets/:id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(req.user, id);
  }

  @Patch('tickets/:id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user, id, dto);
  }

  @Post('tickets/:id/comments')
  comment(@Req() req: any, @Param('id') id: string, @Body() b: { body: string; internal?: boolean }) {
    return this.svc.comment(req.user, id, b.body, b.internal);
  }
}
