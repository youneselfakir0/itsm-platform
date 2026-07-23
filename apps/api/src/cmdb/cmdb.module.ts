import { Module } from '@nestjs/common';
import { CmdbService } from './cmdb.service';
import { CmdbController } from './cmdb.controller';

@Module({ providers: [CmdbService], controllers: [CmdbController] })
export class CmdbModule {}
