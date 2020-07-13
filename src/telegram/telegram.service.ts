import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from 'axios';
import { User as TelegramUser, Chat, Message, WebhookInfo } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex } from "../constants";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";
import { IntegrationEditData } from "discord.js";

const https = require('https');

@Injectable()
export class TelegramService {
  private inactive: boolean = false;
  private botId: string;
  private twitterBot: any;
  private telegramBaseUrl: string;
  private axio: AxiosInstance;

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

    this.axio = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false
      })
    });
    
    this.telegramBaseUrl = `https://api.telegram.org/bot${this.config.telegramToken}`;
    
    this._get('getMe', ).then((result) => {
      let res = result.data
      
      if (res.result) {
        this.botId = res.result.username;
        this.log.info(`Bot ID set to ${this.botId}`);

        this._get('getWebhookInfo').then( (res) => {
          this.log.info(`Webhook info: ${JSON.stringify(res)}`);

          // Check existing webhooks. Look for our URL
          if (res.result) {
            const wh: WebhookInfo = res.result;
            if (this.config.webhooks.telegram.url === wh.url) {
              this.log.info("Webhook already established. We're good to go.");
              return;
            }
          }

          this._post('setWebhook', {
            url: this.config.webhooks.telegram.url ,
            allowed_updates: ["message", "inline_chat", "channel_post"]
          }).then(() => {
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

  // Public messafes - inline chat ??
  public parseMessage = async (message: Message): Promise<any> => {
    this.log.debug(`Parsing message: ${JSON.stringify(message)}`);
     const sender = await this.userRepo.getTelegramUser(message.from.username);
  //   const entities = tweet.extended_tweet ? tweet.extended_tweet.entities : tweet.entities;
  //   const tweetText = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.text;
  //   const tipInfo = tweetText.match(twitterTipRegex((await this.getUser()).twitterName));
  //   this.log.debug(`Got tipInfo ${JSON.stringify(tipInfo)}`);
  //   if (tipInfo && tipInfo[3]) {
  //     try {
  //       this.log.debug(`Trying to tip..`);
  //       const recipientUser = entities.user_mentions.find(
  //         user => user.screen_name === tipInfo[2],
  //       );
  //       const recipient = await this.userRepo.getTwitterUser(recipientUser.id_str, tipInfo[2]);
  //       const response = await this.message.handlePublicMessage(
  //         sender,
  //         recipient,
  //         tipInfo[3],
  //         tweetText,
  //       );
  //       if (response) {
  //         await this.tweet(
  //          `@${tweet.user.screen_name} ${response}`,
  //           tweet.id_str,
  //         );
  //       }
  //     } catch (e) {
  //       this.log.error(e);
  //       await this.tweet(
  //        `@${tweet.user.screen_name} Oh no, something went wrong. @glamperd can you please fix me?`,
  //         tweet.id_str,
  //       );
  //     }
  //   } else {
  //     this.log.info(`Tweet isn't a well formatted tip, ignoring: ${tweetText}`);
  //   }
  }

  public parseDM = async (dm: Message): Promise<any> => {
    this.log.debug(`Parsing dm: ${JSON.stringify(dm)}`);
    const senderId = dm.from.username;
    const chatId = dm.chat.id;
    let sender = await this.userRepo.getTelegramUser(senderId);
    let message = dm.text;
    // Telegram has parsed the command and recipient username. Get them.
    let command: string, recipientTag: string, amount: string;
    dm.entities.forEach(entity => {
      const e = message.substring(entity.offset, entity.offset + entity.length);
      if ("bot_command" === entity.type) {
        command = e;
      } else if ("mention" === entity.type) {
        recipientTag = e;
      }
    });
    switch(command) {
      case '/send': {
        this.handleSend(sender, recipientTag, dm);
        break;
      }
      case '/help': {
        this.handleHelp(sender);
        break;
      }
      case '/balance': {
        this.handleDM(sender, dm);
        break;
      }
      case '/redeem': {
        this.handleDM(sender, dm);
        break;
      }
      case '/withdraw': {
        //this.handleWithdraw(sender, recipientTag, amount, dm);
        break;
      }
    }
  }

  private handleHelp = async (sender: User, ) => {
    const reply = {
      chat_id: sender.telegramId,
      text: '',
      disable_web_page_preview: true,   
    };

    reply.text = `I can help you do these things: \n
      /balance Request your current balance and withdraw link\n
      /send To send some Gazecoin to another Telegram user\n
      /redeem To deposit some funds using a link obtained from ${this.config.paymentUrl}`;
    await this._post('sendMessage', reply);
  }

  private handleSend = async (sender: User, recipientTag: string, message: Message) => {
    const recipient = await this.userRepo.getTelegramUser(recipientTag);
    const messageInfo = message.text.match(telegramTipRegex());
    const amount = messageInfo[3];
    const reply = {
      chat_id: sender.telegramId,
      text: '',
      disable_web_page_preview: true,          
    };
    if (!messageInfo || !amount || !recipient) {
      this.log.info(`Improperly formatted tip, ignoring`);
      reply.text = 'Huh??? :confused:';
      await this._post('sendMessage', reply);
      return;
    }
    this.log.debug(`Message regex info: ${stringify(messageInfo)}`);

    const response = await this.message.handlePublicMessage(
      sender,
      recipient,
      amount,
      message.text,
    );
    // Reply with the result
    reply.text = response;
    await this._post('sendMessage', reply);
  }

  private handleDM = async (sender: User, message: Message) => {
    const response = await this.message.handlePrivateMessage(
      sender,
      message.text,
    );
    // Reply with the result
    const reply = {
      chat_id: message.chat.id,
      text: response[0],
      disable_web_page_preview: true,
      reply_to_message_id: message.message_id,
    };

    const sentMsg = await this._post('sendMessage', reply);
    this.log.debug(`Reply sent: ${JSON.stringify(sentMsg)}`);
  }

  public getUserByName = async (chat_id, screen_name) => {
    if (this.inactive) { return; }
    const res = await this._post('getChatMember', {"chat_id": chat_id, "user_id":screen_name});
    return res;
  }

  _get = (method: string): Promise<any> => {
    this.log.debug(`GET URL: ${method}`);
    const url = `${this.telegramBaseUrl}/${method}`;
    return new Promise((resolve, reject) => {
      this.axio.get(url).then( (result) => {
        let res = result.data
        resolve(res);
      }).catch((err) => {
        reject(err)
      });
    });
  }

  _post = (method: string, data: any = {}): Promise<any> => {
    const url = `${this.telegramBaseUrl}/${method}`;
    this.log.debug(`POST URL: ${url}`);
    return new Promise((resolve, reject) => {
      this.axio.post(url, data).then((result) => {
        let res = result.data
        resolve(res);
      }).catch((err) => {
        reject(err)
      })
    });
  }

}
