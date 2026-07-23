import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule implements OnModuleInit {
  constructor(private wf: WorkflowService) {}
  onModuleInit() {
    // Timer SLA : évalue les breaches toutes les 60s (notif + escalade)
    const ms = Number(process.env.SLA_TIMER_MS || 60000);
    setInterval(() => { this.wf.evaluateSla().catch(() => {}); }, ms);
  }
}
