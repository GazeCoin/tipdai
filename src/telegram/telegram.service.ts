import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import axios from 'axios';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex } from "../constants";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";

const https = require('https');

@Injectable()
export class TelegramService {
  private inactive: boolean = false;
  private botId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly log: LoggerService,
    private readonly userRepo: UserRepository,
    private readonly message: MessageService,
  ) {
    this.log.setContext("TelegramService");
    this.log.info(`Good morning!`);

    if (!this.config.telegramToken) {
      this.log.warn(`No token provided, Telegram stuff won't work.`);
      this.inactive = true;
      return;
    }

    const axio = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false
      })
    });
    
    const telegramBaseUrl = `https://api.telegram.org/bot${this.config.telegramToken}`;
    
    axio.get(`${telegramBaseUrl}/getMe`, ).then((result) => {
      let res = result.data
      
      if (res.result) {
        this.botId = res.result.username;
        this.log.info(`Bot ID set to ${this.botId}`);

        axio.get(`${telegramBaseUrl}/getWebhookInfo`).then( result => {
          res = result.data;

          this.log.info(`Webhook info: ${JSON.stringify(res)}`);

          // Check existing webhooks. Look for our URL
          if (res.result) {
            if (this.config.webhooks.telegram.url === res.result.url) {
              this.log.info("Webhook already established. We're good to go.");
              return;
            }
          }

          axio.post(`${telegramBaseUrl}/setWebhook`, {
            url: this.config.webhooks.telegram.url ,
            allowed_updates: ["message"]
          }).then(resolve => {
            this.log.info("Webhook set. We're ready to go!");
          });
        });
      } else {
        this.log.warn(`Error getting bot ID from telegram. ${JSON.stringify(res)}`);
      };

    }).catch((reject) => {
      this.log.warn(`Error requesting bot ID from telegram. ${JSON.stringify(reject)}`);
    });

  }
}
