import { stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { User as TelegramUser, InlineQuery, Message, CallbackQuery, 
  InlineKeyboardButton, InlineKeyboardMarkup, InlineQueryResultArticle, ChosenInlineResult } from 'telegram-typings';

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { telegramTipRegex, telegramMention } from "../constants";
import { Telegram } from "./telegram.client";
import { MessageService } from "../message/message.service";
import { UserRepository } from "../user/user.repository";
import { User } from "../user/user.entity";
import { TelegramMessage } from "../types";

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
    const sender = await this.userRepo.getTelegramUser(query.from.id, query.from.username);
    let messageInfo = query.query.match(telegramTipRegex());
    this.log.debug(`query match: ${messageInfo}`);

    let results = [];
    if (messageInfo) {
      if (messageInfo.length > 3 && messageInfo[3]) {
          // Username and amount. May not be final
          const recipientTag = messageInfo[1];
          const amount = messageInfo[3];
          const title = `Send GZE${amount} to @${recipientTag}. OK?`;
          const text = `@${sender.telegramUsername} sent GZE${amount} to @${recipientTag}`;
          const result = this.createInlineKBArticle(title, text, 
             this.telegramBot.botPMInlineKeyboardMarkup());
          results = [ result ];
          await this.telegramBot.answerInlineQuery(query.id, results, { });
      }
    } else {
      // Handle /request instructions
      messageInfo = query.query.match(`/\/request\s+([0-9]+)/i`);
      if (messageInfo) {
        this.log.debug(`Creating request`);
        const amount = messageInfo[1];
        const title = `Create tip request for GZE${amount}. OK?`;
        const text = `Please send @${sender.telegramUsername} a tip`;
        const result = this.createInlineKBArticle(title, text, {inline_keyboard: [[
          {
            text: 'Send a tip',
            switch_inline_query_current_chat: `@${this.telegramBot.botUser.username} @${sender.telegramUsername} ${amount}`,
          }
        ]]});
        results = [ result ];
        await this.telegramBot.answerInlineQuery(query.id, results, { });

      }
    }
  }

  private createInlineKBArticle = (title: string, text: string, keyboard: InlineKeyboardMarkup): InlineQueryResultArticle => {
    return {
      type: 'article',
      id: '1',
      title: title,
      input_message_content: {message_text: text},
      reply_markup: keyboard,
    };    
  }

  public parseChannelPost = async(message: TelegramMessage): Promise<any> => {
    // Most channel posts are ignored since they don't identify the sender. 
    // We use channel posts that result from clicking to confirm a send because 
    // the sender is placed in the message text by the bot
    this.log.debug(`Parsing channel post: ${JSON.stringify(message)}`);
    // Make sure this came from me
    if (!message.via_bot || !this.telegramBot.isMe(message.via_bot.id)) {
      this.log.info('Ignoring channel post from another bot');
      return;
    }

    // TODO - moved from here to chosenInlineResult, because this didn't work in group chats. 

    // Parse the text
    // const messageInfo = message.text.match(telegramSendRegex());
    // if (messageInfo && messageInfo.length > 4) {
    //   const sender = await this.userRepo.getTelegramUser(undefined, messageInfo[1].toLowerCase());
    //   const recipient = await this.userRepo.getTelegramUser(undefined, messageInfo[4].toLowerCase());
    //   const amount = messageInfo[3];

    //   const response = await this.message.handlePublicMessage(
    //     sender,
    //     recipient,
    //     amount,
    //     message.text
    //   );
    //   this.log.debug(`${response}`);
    //   // Update the message to show status
    //   if (response.startsWith('Success')) {
    //     const msg = await this.telegramBot.editMessageText(
    //       message.chat.id,
    //       message.message_id,
    //       `@${sender.telegramUsername} sent GZE${amount} to @${recipient.telegramUsername}`,
    //     );
    //     // Send message to sender
    //     if (sender.telegramId) {
    //       const msg = await this.telegramBot.sendMessage(
    //         sender.telegramId,
    //         `You sent GZE${amount} to @${recipient.telegramUsername}. Use /balance to see your new balance and cashout link.`,
    //       );
    //       this.log.debug(msg);
    //     }
    //     // Send message to recipient if we know them
    //     if (recipient.telegramId) {
    //       const msg = await this.telegramBot.sendMessage(
    //         recipient.telegramId,
    //         `@${sender.telegramUsername} sent GZE${amount} to you. You can now see your new balance and cashout link, and send tips to other users.`,
    //       );
    //       this.log.debug(msg);
    //     } else {
    //       // ... and if we don't know them, post in the chat.
    //       // TODO - add a keyboard button for DM link
    //       const msg = await this.telegramBot.sendMessage(
    //         message.chat.id,
    //         `@${recipient.telegramUsername}: @${sender.telegramUsername} sent GZE${amount} to you. You can now send tips. DM me to see your balance and cashout link.`,
    //         undefined, 
    //         { }
    //       );

    //     }
    //   } else {
    //     // fail
    //     this.telegramBot.editMessageText(
    //       message.chat.id,
    //       message.message_id,
    //       `@${messageInfo[1]} tried to send GZE${amount} to @${messageInfo[4]}. Sorry it didn't work out.`,
    //     )
    //   }
    // } 
  }

  public respondToInlineResult = async(result: ChosenInlineResult): Promise<any> => {
    this.log.debug(`Handling query result: ${JSON.stringify(result)}`);
    // This needs to handle send requests when in a group chat but not a channel.
    const sender = await this.userRepo.getTelegramUser(result.from.id, result.from.username);
    const messageInfo = result.query.match(telegramTipRegex());
    const recipient = await this.userRepo.getTelegramUser(undefined, messageInfo[1].toLowerCase());

    // Parse the text
    if (messageInfo && messageInfo.length > 2) {
      const amount = messageInfo[2];
      await this.sendTip(sender, recipient, amount, result.query);
    }
  }

  parseCallbackQuery = async (query: CallbackQuery): Promise<any> => {
    this.log.debug(`Parsing callback query: ${query}`);
    // TODO - this will 
  }

  public parseDM = async (dm: Message): Promise<any> => {
    this.log.debug(`Parsing dm: ${JSON.stringify(dm)}`);
    let sender = await this.userRepo.getTelegramUser(dm.from.id, dm.from.username);
    let message = dm.text;
    // Telegram has parsed the command and recipient username. Get them.
    let command: string, recipientTag: string;
    if (dm.entities) {
      dm.entities.forEach(entity => {
        const e = message.substring(entity.offset, entity.offset + entity.length);
        if ("bot_command" === entity.type) {
          command = e;
        } else if ("mention" === entity.type) {
          recipientTag = e.substring(1); // strip the leading @
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
      case '/request': {
        this.handleRequest(sender, dm);
      }
    }
  }

  private sendTip = async (sender: User, recipient: User, amount: string, message: string): Promise<any> => {

    // Do the send
    const response = await this.message.handlePublicMessage(
      sender,
      recipient,
      amount,
      message
    );
    this.log.debug(`${response}`);

    // Update the message to show status
    if (response.startsWith('Success')) {

      // Send message to sender
      if (sender.telegramId) {
        const msg = await this.telegramBot.sendMessage(
          sender.telegramId,
          `You sent GZE${amount} to @${recipient.telegramUsername}. Use /balance to see your new balance and cashout link.`,
        );
        this.log.debug(msg);
      }
      // Send message to recipient if we know them
      if (recipient.telegramId) {
        const msg = await this.telegramBot.sendMessage(
          recipient.telegramId,
          `@${sender.telegramUsername} sent GZE${amount} to you. You can now see your new balance and cashout link, and send tips to other users.`,
        );
        this.log.debug(msg);
      }
    }
  }

  private handleStart = async (message: Message) => {
    await this.telegramBot.sendMessage(
      message.chat.id,
      `Hi! Click an option or enter a command. Type / to see the available commands.`,
      {
        // ReplyKeyboardMarkup
        keyboard: [
         [{ text: 'Balance' },
          { text: 'Help' }]
        ],
      });
  }

  private handleHelp = async (message: Message) => {
    const text = `In this private chat I can help you do these things: 
*/balance* Request your current balance and withdraw link
*/send _@user_ _amount_* Send some GazeCoin to @user
*/topup* To add to your funds using a link obtained from [your GazeCoin wallet](${this.config.paymentUrl})\\.
*/request _amount_* to generate a request that can be sent to a chat\\.\n\n` +
    `In public chats I can be summoned by starting a message with my name, @${this.telegramBot.botUser.username}\\. ` +
    `In this context I can only do _send_ requests\\. Type the recipient\\'s name and the amount of GazeCoin to send\\.\n` +
    `Example\\: \`@${this.telegramBot.botUser.username} @jenny 5 \`\n` +
    `When it looks OK to me I\\'ll show a button you can press to confirm the transaction\\. The members of the chat ` +
    `will see that you\\'ve sent a tip\\.`;
    await this.telegramBot.sendMessage(
      message.chat.id,
      text,
      undefined,
      {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }
    );
  }

  private handleRequest = async (sender: User, message: Message) => {
    // TODO - send a message to a chosen chat. How to see the choice???
    // The message will be something like: 'Send me a tip', and will have a button that will link to @GazeTipsBot @user amount.
    await this.telegramBot.sendMessage(message.chat.id, 'Please send me a tip', undefined, 
      {
        reply_markup: {
          inline_keyboard: [[ {
            text: 'Forward a tip request',
            switch_inline_query: `/request @${sender.telegramUsername} 1`
          } ]]
        }
      }
    );
  }

  private handleSend = async (sender: User, recipientTag: string, message: Message) => {
    const recipient = await this.userRepo.getTelegramUser(undefined, recipientTag.toLowerCase());
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

    await this.sendTip(sender, recipient, amount, message.text);
  }

  // balance and topup requests.
  private handleDM = async (sender: User, message: Message) => {
    const response = await this.message.handlePrivateMessage(
      sender,
      message.text,
    );
    this.log.debug(`response: ${response}`);
    let resp = response[0];

    // Reply with the result
    const options = {
      disable_web_page_preview: true,
      reply_markup: undefined,
    };

    const zeroBal = resp.match(/.*balance is GZE0\.\s.*(https:.*)\).*/i);
    if (zeroBal) {
      this.log.debug(`${zeroBal[1]}`);
      const button: InlineKeyboardButton = {
        text: 'Wallet',
        url: zeroBal[1],
      };
      const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[ button ]]
      };
      options.reply_markup = keyboard;
    } else {
      // balance and topup response
      const urlPos = resp.indexOf('http');
      if (urlPos > 0) {
        const url = resp.substring(urlPos);
        resp = resp.substring(0, urlPos);

        const button: InlineKeyboardButton = {
          text: 'Cashout Link',
          url
        };
        const keyboard: InlineKeyboardMarkup = {
          inline_keyboard: [[ button ]]
        };
        options.reply_markup = keyboard;
      }
    }

    const sentMsg = await this.telegramBot.sendMessage(
      message.chat.id,
      resp,
      undefined,
      options
    );
    this.log.debug(`Reply sent: ${JSON.stringify(sentMsg)}`);
  }
}
