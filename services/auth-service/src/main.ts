import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`[auth-service] listening on :${port}`);
}
bootstrap();
