import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { User as TelegramUser, InlineQuery, Message, CallbackQuery } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex, telegramQueryRegex } from "../constants";
import { Telegram } from "./telegram.client";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";

const https = require('https');

@Injectable()
export class TelegramService {
  private inactive: boolean = false;
  private botId: string;
  private telegramBot: Telegram;

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

    this.telegramBot = new Telegram(this.config.telegram);
    
    this.telegramBot.initBot();
  }

  // Public messages - inline chat ??
  public parseInlineQuery = async (query: InlineQuery): Promise<any> => {
    this.log.debug(`Parsing query: ${JSON.stringify(query)}`);
     const sender = await this.userRepo.getTelegramUser(query.from.username);
     let command: string, recipientTag: string;
     const messageInfo = query.query.match(telegramQueryRegex());
     const amount = (messageInfo && messageInfo.length > 2) ? messageInfo[2] : undefined;
     recipientTag = (messageInfo && messageInfo.length > 1) ? messageInfo[1] : undefined;
     const recipient = await this.userRepo.getTelegramUser(recipientTag);

     if (!messageInfo || !amount || !recipient) {
       this.log.info(`Improperly formatted request, ignoring`);
       await this.telegramBot.answerInlineQueryWithText(query.id, ['Huh??']);
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
     await this.telegramBot.answerInlineQueryWithText(query.id, [response]);
       //'input_message_content': {'message_text': response},
      
      //reply.switch_pm_text = 'See your updated balance';

  }

  // Public messafes - inline chat ??
  public parseCallbackQuery = async (query: CallbackQuery): Promise<any> => {
    this.log.debug(`Parsing query: ${JSON.stringify(query)}`);
     const sender = await this.userRepo.getTelegramUser(query.from.username);
    //  let command: string, recipientTag: string;
    //  const messageInfo = query.query.match(telegramQueryRegex());
    //  const amount = (messageInfo && messageInfo.length > 2) ? messageInfo[2] : undefined;
    //  recipientTag = (messageInfo && messageInfo.length > 1) ? messageInfo[1] : undefined;
    //  const recipient = await this.userRepo.getTelegramUser(recipientTag);
    await this.telegramBot.answerInlineQueryWithText(query.id, ['answer']);
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
      case '/topup': {}
      case 'Topup': {
        this.handleDM(sender, dm);
        break;
      }
      case '/withdraw': {}
      case 'Cashout': {
        //this.handleWithdraw(sender, recipientTag, amount, dm);
        break;
      }
    }
  }

  private handleStart = async (message: Message) => {
    await this.telegramBot.sendMessage(
      message.chat.id,
      `Hi! Click an option or enter a command`,
      {
        // ReplyKeyboardMarkup
        keyboard: [
        [{ text: 'Balance' },
        { text: 'Help' }]
        ],
      });
  }

  private handleHelp = async (message: Message) => {
    await this.telegramBot.sendMessage(
      message.chat.id,
      `I can help you do these things: 
*/balance* Request your current balance and withdraw link
*/send* Send some GazeCoin to another Telegram user
*/topup* To add to your funds using a link obtained from [the Gazecoin payments site](${this.config.paymentUrl})`,
      undefined,
      {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }
    );
  }

  private handleSend = async (sender: User, recipientTag: string, message: Message) => {
    const recipient = await this.userRepo.getTelegramUser(recipientTag);
    const messageInfo = message.text.match(telegramTipRegex());
    const amount = (messageInfo && messageInfo.length > 3) ? messageInfo[3] : undefined;
    if (!messageInfo || !amount || !recipient) {
      this.log.info(`Improperly formatted tip, ignoring`);
      return this.telegramBot.sendMessage(
        message.chat.id,
        'Huh??? 😕',
      );
    }
    this.log.debug(`Message regex info: ${stringify(messageInfo)}`);

    const response = await this.message.handlePublicMessage(
      sender,
      recipient,
      amount,
      message.text,
    );
    // Reply with the result
    await this.telegramBot.sendMessage(
      message.chat.id,
      response,
      undefined,
      {
        disable_web_page_preview: true,
      }
    );
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

    const sentMsg = await this.telegramBot.sendMessage(
      message.chat.id,
      response[0],
      undefined,
      {
        disable_web_page_preview: true,
      }
    );
    this.log.debug(`Reply sent: ${JSON.stringify(sentMsg)}`);
  }
}
