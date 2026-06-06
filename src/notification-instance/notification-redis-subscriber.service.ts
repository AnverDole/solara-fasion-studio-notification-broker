import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

import { NotificationGateway } from './notification-gateway';
import { NotificationEnvelope } from './notification-instance.types';

@Injectable()
export class NotificationRedisSubscriberService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationRedisSubscriberService.name);

  private readonly redisUrl =
    process.env.MESSAGE_EXCHANGE_REDIS_URL ??
    process.env.REDIS_URL ??
    'redis://localhost:6379';

  private readonly pubsubChannel =
    process.env.MESSAGE_EXCHANGE_PUBSUB_CHANNEL ?? 'message-exchange.broadcast';

  private readonly subscriber: Redis;

  constructor(private readonly gateway: NotificationGateway) {
    this.subscriber = new Redis(this.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.subscriber.on('error', (error) => {
      this.logger.error(`Redis subscriber error: ${error.message}`);
    });

    this.subscriber.on('connect', () => {
      this.logger.log('Redis subscriber connected');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.subscriber.connect();

    await this.subscriber.subscribe(this.pubsubChannel);

    this.subscriber.on('message', (channel, rawMessage) => {
      if (channel !== this.pubsubChannel) {
        return;
      }

      this.handleRawMessage(rawMessage);
    });

    this.logger.log(
      `Subscribed to Redis Pub/Sub channel: ${this.pubsubChannel}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber.status !== 'end') {
      await this.subscriber.quit();
    }
  }

  private handleRawMessage(rawMessage: string): void {
    const envelope = this.parseEnvelope(rawMessage);

    if (!envelope) {
      return;
    }

    this.gateway.emitEnvelope(envelope);
  }

  private parseEnvelope(rawMessage: string): NotificationEnvelope | null {
    try {
      const parsed = JSON.parse(rawMessage) as unknown;

      if (!this.isNotificationEnvelope(parsed)) {
        this.logger.warn('Invalid message exchange envelope received');
        return null;
      }

      return parsed;
    } catch {
      this.logger.warn('Failed to parse message exchange envelope');
      return null;
    }
  }

  private isNotificationEnvelope(
    value: unknown,
  ): value is NotificationEnvelope {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as Record<string, unknown>;

    return (
      typeof record.id === 'string' &&
      typeof record.channel === 'string' &&
      typeof record.event === 'string' &&
      typeof record.createdAt === 'string' &&
      'payload' in record
    );
  }
}
