import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { User as TelegramUser, InlineQuery, Message, CallbackQuery, 
  InlineKeyboardButton, InlineKeyboardMarkup, InlineQueryResultArticle, ChosenInlineResult } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex, telegramQueryRegex } from "../constants";
import { Telegram } from "./telegram.client";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";
import { async } from "rxjs/internal/scheduler/async";

const https = require('https');

@Injectable()
export class TelegramService {
  private inactive: boolean = false;
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

  public isActive = () => !this.inactive;

  // Public messages - inline query.
  // Messages are sent at almost every keypress, so we wait until
  // the messages looks complete, then display a button.
  public parseInlineQuery = async (query: InlineQuery): Promise<any> => {
    this.log.debug(`Parsing inline query: ${JSON.stringify(query)}`);
    const sender = await this.userRepo.getTelegramUser(query.from.username);
    const messageInfo = query.query.match(telegramTipRegex());
    this.log.debug(`query match: ${telegramTipRegex()}  - ${messageInfo}`);

    let answer = '';
    let results = [];
    if (messageInfo) {
      if (messageInfo.length > 3 && messageInfo[3]) {
          // Username and amount. May not be final
          answer = 'Press button to send'
          const recipientTag = messageInfo[1];
          const amount = messageInfo[3];
          const title = `Send GZE${amount} to @${recipientTag}. OK?`;
          const text = `@${sender.telegramId} sent GZE${amount} to @${recipientTag}`;
          // const button: InlineKeyboardButton = {
          //   text: text,
          //   callback_data: JSON.stringify({ sender: sender.telegramId, action: 'send', to: recipientTag, amount })
          // };
          // const keyboard: InlineKeyboardMarkup = { 
          //   inline_keyboard: [[button]]
          // };
          const result: InlineQueryResultArticle = {
            type: 'article',
            id: '1',
            title: title,
            input_message_content: {message_text: text},
            //reply_markup: keyboard,
          };
      
          // Assemble the inline keyboard
          results = [ result ];
          await this.telegramBot.answerInlineQuery(query.id, results, { });
      }
    }
  }

  public respondToInlineResult = async(result: ChosenInlineResult): Promise<any> => {
    this.log.debug(`Handling query result: ${JSON.stringify(result)}`);
    const sender = await this.userRepo.getTelegramUser(result.from.username);
    const messageInfo = result.query.match(telegramTipRegex());
    const recipient = await this.userRepo.getTelegramUser(messageInfo[1]);
    const response = await this.message.handlePublicMessage(
      sender,
      recipient,
      messageInfo[3],
      result.query,
    );
    this.log.debug(`${response}`);
    // Send to sender
    const msg = await this.telegramBot.sendMessage(
      //'@' + result.from.username,
      '@glamperd',
      'test',
    );
    this.log.debug(msg);
    // Send to recipient
    // await this.telegramBot.sendMessage(
    //   '@' + recipient.telegramId,
    //   response,
    // );

  }

  // Callback Query - a guided walk through a send operation
  public parseCallbackQuery = async (query: CallbackQuery): Promise<any> => {
    this.log.debug(`Parsing callback query: ${JSON.stringify(query)}`);
    //  let command: string, recipientTag: string;
    //  const messageInfo = query.query.match(telegramQueryRegex());
    //  const amount = (messageInfo && messageInfo.length > 2) ? messageInfo[2] : undefined;
    //  recipientTag = (messageInfo && messageInfo.length > 1) ? messageInfo[1] : undefined;
    //  const recipient = await this.userRepo.getTelegramUser(recipientTag);
    const state = JSON.parse(query.data);
    if (state && 'send' === state.action && state.to && state.amount) {
      await this.telegramBot.answerCallbackQuery(query.id, 'Sending...');
      // Have everything - send it

    } else {
      await this.telegramBot.answerCallbackQuery(query.id, 'Enter amount');
      const button: InlineKeyboardButton = {
        text: '1',
        callback_data: JSON.stringify({...state, amount: '1'})
      };
      const keyboard: InlineKeyboardMarkup = { 
        inline_keyboard: [[button]]
      };
      const result: InlineQueryResultArticle = {
        type: 'article',
        id: '1',
        title: `Send GazeCoin to ${state.to}`,
        input_message_content: {message_text: `Send GazeCoin to ${state.to}`},
        reply_markup: keyboard,
      };
  
       // Assemble the inline keyboard
       const results = [ result ];
  
      await this.telegramBot.answerInlineQuery(query.id, results, {});
    }
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
*/topup* To add to your funds using a link obtained from [your GazeCoin wallet](${this.config.paymentUrl})`,
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
