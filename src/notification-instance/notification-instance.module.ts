import { Module } from '@nestjs/common';

import { NotificationAuthService } from './notification-auth.service';
import { NotificationConnectionRegistryService } from './notification-connection-registry.service';
import { NotificationGateway } from './notification-gateway';
import { NotificationRedisSubscriberService } from './notification-redis-subscriber.service';

@Module({
  providers: [
    NotificationAuthService,
    NotificationConnectionRegistryService,
    NotificationGateway,
    NotificationRedisSubscriberService,
  ],
})
export class NotificationInstanceModule {}
