import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { formatEther, parseEther } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { PaymentService } from "../payment/payment.service";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";

import { Tip } from "./tip.entity";
import { TipRepository } from "../tip/tip.repository";

@Injectable()
export class TipService {
  constructor(
    private readonly config: ConfigService,
    private readonly log: LoggerService,
    private readonly userRepo: UserRepository,
    private readonly tipRepo: TipRepository,
    private readonly payment: PaymentService,
  ) {
    this.log.setContext("TipService");
  }

  public handleTip = async (
    sender: User,
    recipient: User,
    amount: string,
    message: string,
  ): Promise<string> => {
    const amountBN = parseEther(amount);
    this.log.info(`Handling tip of ${amount} from ${JSON.stringify(sender)} to ${JSON.stringify(recipient)}`);
    const newTip = new Tip();
    newTip.message = message;
    newTip.sender = sender;
    newTip.recipient = recipient;
    newTip.amount = amount;
    newTip.result = "PROCESSING";
    await this.tipRepo.save(newTip);
    try {
      if (sender.cashout) {
        sender.cashout = await this.payment.updatePayment(sender.cashout);
      }
      if (!sender.cashout) {
        this.log.info(`Sender balance GZE0 (no deposits) is less than tip amount of ${amount}`);
        newTip.result = "INSUFFICIENT_BALANCE";
        await this.tipRepo.save(newTip);
        return `You don't have a high enough balance to send a GZE${amount} tip, ` +
          `DM me a link payment to increase your balance & then try again.`;
      }
      if (sender.cashout.status !== "PENDING") {
        this.log.info(`Sender balance GZE0 (prev cashout of GZE${sender.cashout.amount} ${sender.cashout.status}) is lower than tip amount of ${amount}`);
        newTip.result = "INSUFFICIENT_BALANCE";
        await this.tipRepo.save(newTip);
        return `You don't have a high enough balance to send a GZE${amount} tip, ` +
          `DM me a link payment to increase your balance & then try again.`;
      }
      if (parseEther(sender.cashout.amount).lt(amountBN)) {
        this.log.info(`Sender balance GZE${sender.cashout.amount} is lower than tip amount of ${amount}`);
        newTip.result = "INSUFFICIENT_BALANCE";
        await this.tipRepo.save(newTip);
        return `You don't have a high enough balance to send a GZE${amount} tip, ` +
          `DM me a link payment to increase your balance & then try again.`;
      }

      this.log.info(`Sender old balance: ${sender.cashout.amount}`);
      const senderBalance = formatEther(
        parseEther(await this.payment.redeemPayment(sender.cashout)).sub(amountBN),
      );
      this.log.info(`Sender new balance: ${senderBalance}`);
      this.log.info(`Redeemed old cashout payment`);
      if (parseEther(senderBalance).gt(Zero)) {
        sender.cashout = await this.payment.createPayment(
          senderBalance,
          sender,
        );
        this.log.info(`Gave sender new cashout payment`);
        await this.userRepo.save(sender);
        this.log.info(`Saved new sender data`);
      }
      this.log.info(`Recipient old balance: GZE${recipient.cashout ? recipient.cashout.amount : "0.00"}`);
      let recipientBalance = amount;
      if (recipient.cashout) {
        this.log.info(`Recipient has cashout payment.. redeeming old one`);
        recipientBalance = formatEther(
          parseEther(await this.payment.redeemPayment(recipient.cashout)).add(amountBN),
        );
      }
      this.log.info(`Recipient new balance: ${recipientBalance}`);
      recipient.cashout = await this.payment.createPayment(recipientBalance, recipient);
      this.log.info(`Gave recipient new cashout payment`);
      await this.userRepo.save(recipient);
      this.log.info(`Saved new recipient data`);
      newTip.result = "SUCCESS";
      await this.tipRepo.save(newTip);
      return `Success! A tip of GZE${amount} has been transfered.\n\n` +
        `@${recipient.getUsername()}, you can now send tips or DM me to cashout.\n\n` +
        `@${sender.getUsername()}, your old cashout link is no longer valid, DM me for a new one`;
    } catch (e) {
      this.log.info(`Failed to handle tip: ${e}`);
      newTip.result = `ERROR: ${e.message}`;
      await this.tipRepo.save(newTip);
      return `Oops something went wrong, it was probably my fault. Hey @glamperd, can you fix me?`;
    }
  }

}
