import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from 'axios';
import { User as TelegramUser, InlineQuery, Message, WebhookInfo, InlineQueryResultArticle, InputTextMessageContent } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex, telegramQueryRegex } from "../constants";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";
import { IntegrationEditData } from "discord.js";
import { ReplaySubject } from "rxjs";

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
    
    this._get('getMe').then((res) => {
      
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
            allowed_updates: ["message", "inline_chat", "channel_post", "inline_query"]
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
  public parseInlineQuery = async (query: InlineQuery): Promise<any> => {
    this.log.debug(`Parsing query: ${JSON.stringify(query)}`);
     const sender = await this.userRepo.getTelegramUser(query.from.username);
     // Telegram has parsed the command and recipient username. Get them.
     let command: string, recipientTag: string;
     const messageInfo = query.query.match(telegramQueryRegex());
     const amount = (messageInfo && messageInfo.length > 2) ? messageInfo[2] : undefined;
     recipientTag = (messageInfo && messageInfo.length > 1) ? messageInfo[1] : undefined;
     const recipient = await this.userRepo.getTelegramUser(recipientTag);
     const reply = {
       inline_query_id: query.id,
       results: [],
       switch_pm_text: undefined,
     };
     if (!messageInfo || !amount || !recipient) {
       this.log.info(`Improperly formatted request, ignoring`);
       //reply.results.push(new InputTextMessageContent('Huh??? :confused:'));
       reply.results = [{
         'type': 'Article',
          'id':'1', 
          'title':'Huh?',
          'input_message_content': {'message_text': 'Huh???'},
       }];
       await this._post('answerInlineQuery', reply);
       return;
     }
     this.log.debug(`Message regex info: ${stringify(messageInfo)}`);
 
     const response = await this.message.handlePublicMessage(
       sender,
       recipient,
       amount,
       query.query,
     );
     // Reply with the result
     //reply.text = response;
     reply.results = [{
      'type': 'Article',
       'id':'1', 
       'title':'Success! Click me.',
       'input_message_content': {'message_text': response},
      }];
      reply.switch_pm_text = 'See your updated balance';
  await this._post('answerInlineQuery', reply);
  }

  public parseDM = async (dm: Message): Promise<any> => {
    this.log.debug(`Parsing dm: ${JSON.stringify(dm)}`);
    const senderId = dm.from.username;
    let sender = await this.userRepo.getTelegramUser(senderId);
    let message = dm.text;
    // Telegram has parsed the command and recipient username. Get them.
    let command: string, recipientTag: string;
    if (dm.entities) {
      dm.entities.forEach(entity => {
        const e = message.substring(entity.offset, entity.offset + entity.length);
        if ("bot_command" === entity.type) {
          command = e;
        } else if ("mention" === entity.type) {
          recipientTag = e;
        }
      });
    } else {
      command = dm.text;
    }
    switch(command) {
      case '/start': {
        this.handleStart(dm);
        break;
      }
      case '/send': {}
      case 'Send': {
        this.handleSend(sender, recipientTag, dm);
        break;
      }
      case '/help': {}
      case 'Help': {
        this.handleHelp(dm);
        break;
      }
      case '/balance': {}
      case 'Balance': {
        this.handleDM(sender, dm);
        break;
      }
      case '/redeem': {}
      case 'Redeem': {
        this.handleDM(sender, dm);
        break;
      }
      case '/withdraw': {}
      case 'Withdraw': {
        //this.handleWithdraw(sender, recipientTag, amount, dm);
        break;
      }
    }
  }

  private handleStart = async (message: Message) => {
    const reply = {
      chat_id: message.chat.id,
      text: `Hi! Click an option.`,
      reply_markup: {
        // ReplyKeyboardMarkup
        keyboard: [
        [{ text: 'Balance' },
        { text: 'Send' }],
        [{ text: 'Redeem' },
        { text: 'Cashout' }],
        [{ text: 'Help' }]
        ],
      }
    };

    await this._post('sendMessage', reply);
  }


  private handleHelp = async (message: Message) => {
    const reply = {
      chat_id: message.chat.id,
      text: `I can help you do these things: 
*Balance* Request your current balance and withdraw link
*Send* Send some GazeCoin to another Telegram user
*Redeem* To add to your funds using a link obtained from [the Gazecoin payments site](${this.config.paymentUrl})`,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    };

    await this._post('sendMessage', reply);
  }

  private handleSend = async (sender: User, recipientTag: string, message: Message) => {
    const recipient = await this.userRepo.getTelegramUser(recipientTag);
    const messageInfo = message.text.match(telegramTipRegex());
    const amount = (messageInfo && messageInfo.length > 3) ? messageInfo[3] : undefined;
    const reply = {
      chat_id: message.chat.id,
      text: '',
      disable_web_page_preview: true,
      reply_markup: {force_reply: 'True'},
    };
    if (!messageInfo || !amount || !recipient) {
      this.log.info(`Improperly formatted tip, ignoring`);
      reply.text = 'Huh??? 😕';
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
