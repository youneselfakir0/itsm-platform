import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { DbService } from './db.service';
import { JwtAuthGuard } from './jwt.guard';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET || 'dev-secret-change-me' }),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, DbService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
