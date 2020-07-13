import * as crypto from "crypto";
import { Body, Controller, Get, Post, Query, Param, Res, HttpStatus } from "@nestjs/common";
import { Update, Message } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { QueueService } from "../queue/queue.service";
import { TwitterService } from "../twitter/twitter.service";
import { TelegramService } from "../telegram/telegram.service";
import { UserRepository } from "../user/user.repository";

type TwitterCRCResponse = {
  response_token: string;
};

@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly config: ConfigService,
    private readonly log: LoggerService,
    private readonly queueService: QueueService,
    private readonly twitter: TwitterService,
    private readonly telegram: TelegramService,
    private readonly userRepo: UserRepository,
  ) {
    this.log.setContext("WebhooksController");
  }

  @Get("twitter")
  doTwitterCRC(@Query() query: any): TwitterCRCResponse {
    const hmac = crypto
      .createHmac("sha256", this.config.twitterHmac)
      .update(query.crc_token);
    const response_token = `sha256=${hmac.digest("base64")}`;
    this.log.info(`Got CRC, responding with: ${response_token}`);
    return { response_token };
  }

  @Post("twitter")
  async handleTwitterEvent(@Query() query: any, @Body() body: any): Promise<any> {
    const keys = Object.keys(body).filter(key => key !== "for_user_id");
    this.log.debug(`Got twitter events: ${JSON.stringify(keys)}`);

    if (body.tweet_create_events) {
      body.tweet_create_events.forEach(tweet => {
        if (tweet.user.id_str === this.config.twitterBotUserId) { return; }
        this.queueService.enqueue(async () => this.twitter.parseTweet(tweet));
      });
    }

    if (body.direct_message_events) {
      body.direct_message_events.forEach(dm => {
        if (dm.message_create.sender_id === this.config.twitterBotUserId) { return; }
        this.queueService.enqueue(async () => this.twitter.parseDM(dm));
      });
    }

  }

  @Post("telegram/:token")
  async handleTelegramEvent(@Param('token') token: string, @Body() update: Update, @Res() response: any): Promise<any> {
    this.log.debug(`Got TG token ${token} body:${JSON.stringify(update)}`);
    // Check validity of the token
    if (token !== this.config.telegramToken) {
      this.log.warn(`Invalid token in webhook callback URL. ${token}`);
      response.status(HttpStatus.FORBIDDEN).send();
      return;
    }
    this.log.debug(`Got telegram updates: ${JSON.stringify(update)}`);

    if (update.message.from.username === this.config.telegramBotId) { return; }
    if ('private' === update.message.chat.type) {
      this.queueService.enqueue(async () => this.telegram.parseDM(update.message));
    } else {
      this.queueService.enqueue(async () => this.telegram.parseMessage(update.message));
    }
  }

}
