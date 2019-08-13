import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwitterModule } from './twitter/twitter.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [TwitterModule, WebhooksModule, ConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
