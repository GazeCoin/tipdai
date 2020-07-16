/*
 Telegram API client
 */

import axios, { AxiosInstance } from 'axios';
import { User as TelegramUser, InlineQuery, Message, WebhookInfo, CallbackQuery, InlineQueryResult,
  InlineQueryResultArticle, InputTextMessageContent, ReplyKeyboardMarkup } from 'telegram-typings';

import { TelegramConfig } from "../types";

const https = require('https');

export class Telegram {
  inactive: boolean = false;
  botId: string;
  baseUrl: string;
  axio: AxiosInstance;
  botToken: string;
  log?: any;
  webhookUrl: any;
  botUser: TelegramUser;

  constructor(config: TelegramConfig) {
    this.log = config.log || console;
    this.webhookUrl = config.webhookUrl;
    this.botToken = config.botToken;

    this.axio = axios.create({
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false
      })
    });
    
    this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
  }

  initBot = async (): Promise<any> => {
    this.getBot().then((res) => {
      
      if (res.result) {
        this.botUser = res.result;
        this.botId = res.result.username;
        this.log.info(`Bot ID set to ${this.botId}`);

        this.getWebhooks().then( (res) => {
          this.log.info(`Webhook info: ${JSON.stringify(res)}`);

          // Check existing webhooks. Look for our URL
          if (res.result) {
            const wh: WebhookInfo = res.result;
            if (this.webhookUrl === wh.url) {
              this.log.info("Webhook already established. We're good to go.");
              return;
            }
          }

          this.createWebhook();
        });
      } else {
        this.log.warn(`Error getting bot ID from telegram. ${JSON.stringify(res)}`);
      };

    }).catch((reject) => {
      this.log.warn(`Error requesting bot ID from telegram. ${JSON.stringify(reject)}`);
    });
  }

  createWebhook = async (): Promise<any> => {
    this._post('setWebhook', {
      url: this.webhookUrl,
      allowed_updates: [
        "message",
        "channel_post", // TODO need this?
        "inline_query",
        "callback_query", // TODO this?
        "chosen_inline_result"
      ]
    })
  }

  removeWebhook = async (): Promise<any> => {
    return this._get('deleteWebhook');
  }

  getWebhooks = async (): Promise<any> => {
    return this._get('getWebhookInfo');
  }

  getBot = async (): Promise<any> => {
    return this._get('getMe');
  }

  isMe = (id: number):boolean => {
    return id === this.botUser.id;
  }

  sendMessage = async (
    chatId: number | string, 
    message: string, 
    replyKeyboardMarkup?: ReplyKeyboardMarkup,
    options?: any
    ): Promise<any> => {

    const messageParams = {
      chat_id: chatId,
      text: message,
      reply_markup: replyKeyboardMarkup,
      ...options,
    };

    return this._post('sendMessage', messageParams);  
  }

  editMessageText = async (
    chatId: number | string, 
    messageId: number, 
    text: string,
    options?: any
  ): Promise<any> => {
    const messageParams = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      ...options,
    };

    return this._post('editMessageText', messageParams);
  }

  // Text-only result list. The InlineQueryResult set will be assembled here. 
  answerInlineQueryWithText = async (queryId:string, options: string[]): Promise<any> => {
    const articles = options.map((val, idx) => {
      return {
        'type': 'Article',
          'id':(idx+1).toString(), 
          'title':val,
          'input_message_content': {'message_text': val},
      }
    });
    const reply = {
      inline_query_id: queryId,
      results: articles,
    };
    return this._post('answerInlineQuery', reply);
  }

  // Caller provides the array of InlineQueryResult. Suitable for composing inline keyboards.
  answerInlineQuery = async (queryId:string, results: InlineQueryResult[], options: any): Promise<any> => {
    const reply = {
      inline_query_id: queryId,
      results,
      cache_time: 1,
      //switch_pm_text: 'PM',
      //switch_pm_parameter: '/start',
    };
    return this._post('answerInlineQuery', reply);
  }

  answerCallbackQuery = async (queryId: string, answer: string): Promise<any> => {
    const reply = {
      callback_query_id: queryId,
      text: answer,
    };
    return this._post('answerCallbackQuery', reply);
  }

  public getUserByName = async (chat_id, screen_name) => {
    if (this.inactive) { return; }
    const res = await this._post('getChatMember', {"chat_id": chat_id, "user_id":screen_name});
    return res;
  }


  sendDM = async (recipient_id, text): Promise<any> => {
    // TODO
  }

  ////////////////////////////////////////
  // Private Methods
  _get = (method: string): Promise<any> => {
    this.log.debug(`GET URL: ${method}`);
    const url = `${this.baseUrl}/${method}`;
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
    const url = `${this.baseUrl}/${method}`;
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
