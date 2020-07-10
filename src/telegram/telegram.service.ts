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
    void (async () => {
      let res = (await axio.get(`${telegramBaseUrl}/getMe`, )).data;
      this.botId = res.result ? res.result.username : undefined;
    });

    void (async () => {
      let res = (await axio.post(`${telegramBaseUrl}/setWebhook`, {
        url: this.config.webhooks.telegram.url ,
        allowed_updates: ["Message", "User", "BotCommand"]
      }));
    });

    if (this.botId) {
      this.log.info("Successfully logged in. We're ready to go!");
    };

    // // Getting all updates
    // this.airgram.use((ctx, next) => {
    //   if ('update' in ctx) {
    //     this.log.info(`[all updates] ${JSON.stringify(ctx.update)}`)
    //   }
    //   return next()
    // })

    // // Getting new messages
    // this.airgram.on('updateNewMessage', async ({ update }, next) => {
    //   const { message } = update
    //   this.log.info(`[new message] ${message}`);

    //   if (message.author.bot) return;
    //   this.log.info(`Received tg message: ${stringify(message)}`);
    //   this.log.info(`Mentions: ${stringify(message.mentions)}`);

    //   const mentions = message.mentions.users.map(user => user.id).concat(message.mentions.roles.map(user => user.id));
    //   const sender = await this.userRepo.getTelegramUser(message.author.id);
    //   this.log.info(`mentions: ${stringify(mentions)} sender: ${stringify(sender)}`);

    //   // If this is a private 1-on-1 message
    //   if (message.guild === null) {
    //     const responses = await this.message.handlePrivateMessage(sender, message.cleanContent);
    //     const response = responses.reduce((acc, curr) => {
    //       return acc += `${acc}${curr}`;
    //     }, "");
    //     message.channel.send(response);

    //   // If this is a public message that only mentions TipDai & one other user
    //   } else if (
    //     !message.mentions.everyone &&
    //     mentions.includes(this.config.telegramBotId) &&
    //     mentions.length === 2
    //   ) {
    //     const messageInfo = message.content.match(telegramTipRegex(this.config.telegramBotId));
    //     if (!messageInfo || !messageInfo[3]) {
    //       this.log.info(`Improperly formatted tip, ignoring`);
    //       message.channel.send('Huh??? :confused:');
    //       return;
    //     }
    //     this.log.info(`Message regex info: ${stringify(messageInfo)}`);

    //     const recipient = await this.userRepo.getTelegramUser(
    //       mentions.find(id => id !== this.config.telegramBotId),
    //     );
    //     const response = await this.message.handlePublicMessage(
    //       sender,
    //       recipient,
    //       messageInfo[3],
    //       message.cleanContent,
    //     );
    //   }

    //   return next();
    // })

    // this.airgram.login(this.config.telegramToken);
  }
}
