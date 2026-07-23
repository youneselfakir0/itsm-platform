import { Module } from '@nestjs/common';
import { TicketingService } from './ticketing.service';
import { TicketingController } from './ticketing.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkflowModule, NotificationsModule],
  providers: [TicketingService],
  controllers: [TicketingController],
})
export class TicketingModule {}
