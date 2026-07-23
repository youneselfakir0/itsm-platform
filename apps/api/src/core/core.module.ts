import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    }),
  ],
  providers: [PrismaService, AuthGuard],
  exports: [PrismaService, AuthGuard, JwtModule],
})
export class CoreModule {}
