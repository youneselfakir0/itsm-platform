import { Body, Controller, Get, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Public } from '../core/auth.guard';

@Controller('notify')
export class NotificationsController {
  constructor(private svc: NotificationService) {}

  @Get('health') health() { return { service: 'notifications', status: 'ok' }; }

  @Public() @Post('test')
  test(@Body() dto: { to?: string; title?: string; text?: string }) {
    return Promise.all([
      this.svc.sendEmail(dto.to || process.env.NOTIFY_EMAIL || 'ops@twisterlab.local', dto.title || 'Test TwisterITSM', dto.text || 'Notification de test.'),
      this.svc.sendTeams(dto.title || 'Test TwisterITSM', dto.text || 'Notification de test.'),
    ]);
  }
}
