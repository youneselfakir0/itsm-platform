import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { AutomationModule } from '../automation/automation.module';
import { AutomationService } from '../automation/automation.service';

@Module({
  imports: [AutomationModule],
  providers: [CatalogService, AutomationService],
  controllers: [CatalogController],
})
export class CatalogModule {}
