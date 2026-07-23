import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { AuthGuard } from './core/auth.guard';
import { IdentityModule } from './identity/identity.module';
import { TicketingModule } from './ticketing/ticketing.module';
import { CmdbModule } from './cmdb/cmdb.module';
import { CatalogModule } from './catalog/catalog.module';
import { AutomationModule } from './automation/automation.module';
import { EventsModule } from './events/events.module';
import { ReportingModule } from './reporting/reporting.module';
import { AiModule } from './ai/ai.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    CoreModule, IdentityModule, TicketingModule, CmdbModule, CatalogModule,
    AutomationModule, EventsModule, ReportingModule, AiModule, WorkflowModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
