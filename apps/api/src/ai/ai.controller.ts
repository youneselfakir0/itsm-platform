import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { Permissions } from '../core/auth.guard';

@Controller('ai')
export class AiController {
  constructor(private svc: AiService) {}

  @Get('health') health() { return { service: 'ai', status: 'ok' }; }
  @Get('engine') engine() { return this.svc.engineInfo(); }
  @Permissions('ai:use') @Post('classify') classify(@Body() dto: any) { return this.svc.classify(dto); }
  @Permissions('ai:use') @Post('suggest') suggest(@Body() dto: any) { return this.svc.suggest(dto); }
  @Permissions('ai:use') @Post('script') script(@Body() dto: any) { return this.svc.script(dto); }
  @Permissions('ai:use') @Post('analyze-logs') analyze(@Body() dto: any) { return this.svc.analyzeLogs(dto); }
}
