import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Sérialisation JSON des BigInt (tickets.number, history.id, events.id)
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = Number(process.env.PORT || 8080);
  await app.listen(port);
  console.log(`[twisteritsm-api] listening on :${port}`);
}
bootstrap();
