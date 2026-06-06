import { Module } from '@nestjs/common';

import { NotificationInstanceModule } from './notification-instance/notification-instance.module';

@Module({
  imports: [NotificationInstanceModule],
})
export class AppModule {}
