import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { Public } from '../core/auth.guard';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtUser } from '../core/auth.guard';
import { Permissions } from '../core/auth.guard';

@Controller('auth')
export class IdentityController {
  constructor(private svc: IdentityService) {}

  @Public() @Get('health')
  health() { return { service: 'identity', status: 'ok' }; }

  @Public() @Post('register')
  register(@Body() dto: { email: string; password: string; displayName: string }) { return this.svc.register(dto); }

  @Public() @Post('login')
  login(@Body() dto: { email: string; password: string }) { return this.svc.login(dto); }

  @Public() @Post('mfa/verify')
  mfaVerify(@Body() dto: { mfaToken: string; code: string }) { return this.svc.verifyMfa(dto); }

  @Public() @Post('refresh')
  refresh(@Body() dto: { refreshToken: string }) { return this.svc.refresh(dto); }

  @Get('mfa/enroll')
  enroll(@CurrentUser() user: JwtUser) { return this.svc.enrollMfa(user); }

  @Post('mfa/confirm')
  confirm(@CurrentUser() user: JwtUser, @Body() dto: { code: string }) { return this.svc.confirmMfa(user, dto); }

  @Permissions('admin:*') @Post('ldap/sync')
  sync() { return this.svc.syncAd(); }
}
