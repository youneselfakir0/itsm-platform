import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Get('health')
  health() {
    return { service: 'auth-service', status: 'ok' };
  }

  @Post('auth/register')
  register(@Body() b: { email: string; password: string; displayName: string }) {
    return this.auth.register(b.email, b.password, b.displayName);
  }

  @Post('auth/login')
  login(@Body() b: { email: string; password: string }) {
    return this.auth.login(b.email, b.password);
  }

  @Post('auth/refresh')
  refresh(@Body() b: { refreshToken: string }) {
    return this.auth.refresh(b.refreshToken);
  }
}
