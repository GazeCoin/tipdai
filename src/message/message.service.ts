import { Injectable } from '@nestjs/common';
import { bigNumberify, formatEther, parseEther } from 'ethers/utils';
import { Zero } from 'ethers/constants';

import { ChannelService } from '../channel/channel.service';
import { ConfigService } from '../config/config.service';
import { DepositService } from '../deposit/deposit.service';
import { PaymentService } from '../payment/payment.service';
import { TwitterService } from '../twitter/twitter.service';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';

const paymentIdRegex = /paymentId=0x[0-9a-fA-F]{64}/;
const secretRegex = /secret=0x[0-9a-fA-F]{64}/;

@Injectable()
export class MessageService {
  constructor(
    private readonly channel: ChannelService,
    private readonly config: ConfigService,
    private readonly deposit: DepositService,
    private readonly payment: PaymentService,
    private readonly twitter: TwitterService,
    private readonly userRepo: UserRepository,
  ) {
  }

  public handleMessage = async (event) => {
    const sender = event.message_create.sender_id;
    const message = event.message_create.message_data.text;
    const messageUrls = event.message_create.message_data.entities.urls;
    const messageUrl = messageUrls && messageUrls.length ? messageUrls[0].expanded_url : undefined;
    if (sender === this.config.twitterBotUserId) { return; } // ignore messages sent by the bot
    console.log(`Processing message event: ${JSON.stringify(event, null, 2)}`);

    if (message.match(/^crc/i)) {
      try {
        await this.twitter.triggerCRC();
        return await this.twitter.sendDM(sender, 'Successfully triggered CRC!');
      } catch (e) {
        return await this.twitter.sendDM(sender, `CRC didn't go so well..`);
      }
    }

    if (messageUrl && messageUrl.match(paymentIdRegex) && messageUrl.match(secretRegex)) {
      return await this.twitter.sendDM(sender, await this.payment.depositPayment(messageUrl, sender));
    }

    if (message.match(/^balance/i) || message.match(/^refresh/i)) {
      const user = await this.userRepo.getByTwitterId(sender);
      console.log(`user: ${JSON.stringify(user, (key, value) => (key && typeof value === 'object') ? value.toString() : value, 2)}`);
      if (parseEther(user.balance).gt(Zero) && !user.cashout) {
        return await this.twitter.sendDM(sender, `User has balance but no cashout link. This should never happen :(`);
      } else if (!user.balance && user.cashout) {
        return await this.twitter.sendDM(sender, `User has cashout link but no balance. This should never happen :(`);
      } else if (user.balance && user.cashout) {
        return await this.twitter.sendDM(sender, `Balance: $${user.balance}. Cashout anytime by clicking the following link:\n\n${this.config.linkBaseUrl}?paymentId=${user.cashout.paymentId}&secret=${user.cashout.secret}`);
      } else {
        return await this.twitter.sendDM(sender, `Your balance is $0.00. Send a link payment to get started.`);
      }
    }

    if (message.match(/^deposit/i)) {
      const depositAddress = await this.deposit.newDeposit(sender);
      await this.twitter.sendDM(
        sender,
        `Send up to 30 DAI worth of rinkeby ETH to the following address to deposit. ` +
        `This address will be available for deposits for 10 minutes. ` +
        `If you send a transaction with low gas, reply "wait" and the timeout will be extended.`,
      );
      await this.twitter.sendDM(sender, depositAddress);
      return;
    }

    if (message.match(/^wait/i)) {
      const depositAddress = await this.deposit.delayDeposit(sender);
      if (!depositAddress) {
        return await this.twitter.sendDM(
          sender,
          `No deposit found, reply with "deposit" to start a deposit.`,
        );
      }
      await this.twitter.sendDM(
        sender,
        `Timeout extended, you have 10 more minutes to deposit up to 30 DAI worth of rinkeby ETH to the below address. ` +
        `If you want to extend again, reply "wait" as many times as needed.`,
      );
      await this.twitter.sendDM(sender, depositAddress);
      return;
    }
  }

  public handleTweet = async (tweet) => {
    console.log(`Got a tweet event: ${JSON.stringify(tweet, null, 2)}`);
    const message = tweet.text;
    const fromUser = tweet.user.id_str;
    const mentionedUsers = tweet.entities.user_mentions.filter(
      ment => ment.id_str !== this.config.twitterBotUserId,
    );
    const amountMatch = message.match(/\$[0-9]\.?[0-9]*/);
    if (!mentionedUsers.length || !amountMatch) {
      // Improper tweet, ignore
      return;
    }
    const amount = amountMatch[0].replace('$', '');
    const toUser = mentionedUsers[0].id_str;
    let tips = '[]' as any; // (await db.get(`tipsArchive`)) as any;
    if (!tips) {
      tips = [];
    } else {
      tips = JSON.parse(tips);
    }
    tips.push({
      amount,
      fromUser,
      message,
      toUser,
      tweetId: tweet.id_str,
    });
    console.log(`Archived tips: ${JSON.stringify(tips, null, 2)}`);
    // db.set('tipsArchive', JSON.stringify(tips));

    let sender = '{}' as any; // (await db.get(`user-${fromUser}`)) as any;
    if (!sender) {
      sender = { id: sender };
    } else {
      sender = JSON.parse(sender);
    }

    if (!sender.balance || parseEther(sender.balance).lt(parseEther(amount))) {
      console.log(`sender balance ${sender.balance} is lower than ${amount}`);
      return; // TODO: this.twitter.tweet('hey sender you need more money')
    }

    let recipient = '{}' as any; // (await db.get(`user-${toUser}`)) as any;
    if (!recipient) {
      recipient = { id: toUser };
    } else {
      recipient = JSON.parse(recipient);
    }
    if (!recipient.balance) {
      recipient.balance = amount;
    } else {
      recipient.balance = formatEther(
        parseEther(recipient.balance).add(parseEther(amount)),
      );
    }
    console.log(`Recipient: ${JSON.stringify(recipient, null, 2)}`);
    // await db.set(`user-${toUser}`, JSON.stringify(recipient));

  }

}
