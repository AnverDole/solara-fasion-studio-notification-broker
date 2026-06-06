import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NotificationInstance');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const port = Number(process.env.NOTIFICATION_INSTANCE_PORT ?? 4001);

  await app.listen(port);

  logger.log(`Notification instance started on port ${port}`);
}

void bootstrap();