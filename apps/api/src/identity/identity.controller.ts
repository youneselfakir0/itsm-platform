import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { Public } from '../core/auth.guard';

@Controller('auth')
export class IdentityController {
  constructor(private svc: IdentityService) {}

  @Public() @Get('health')
  health() { return { service: 'identity', status: 'ok' }; }

  @Public() @Post('register')
  register(@Body() dto: { email: string; password: string; displayName: string }) { return this.svc.register(dto); }

  @Public() @Post('login')
  login(@Body() dto: { email: string; password: string }) { return this.svc.login(dto); }

  @Public() @Post('refresh')
  refresh(@Body() dto: { refreshToken: string }) { return this.svc.refresh(dto); }
}
