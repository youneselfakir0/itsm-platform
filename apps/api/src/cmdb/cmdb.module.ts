import { Module } from '@nestjs/common';
import { CmdbService } from './cmdb.service';
import { CmdbController } from './cmdb.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  providers: [CmdbService],
  controllers: [CmdbController],
})
export class CmdbModule {}
