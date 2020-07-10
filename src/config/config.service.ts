import { Injectable } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";
import { Wallet } from "ethers";
import * as fs from "fs";

import { PostgresConfig, TwitterConfig } from "../types";

const env = {
  discordId: process.env.DISCORD_ID,
  discordToken: process.env.DISCORD_TOKEN,
  telegramBotId: process.env.TELEGRAM_BOT_ID,
  telegramToken: process.env.TELEGRAM_TOKEN,
  ethProvider: process.env.ETH_PROVIDER,
  logLevel: process.env.LOG_LEVEL,
  mnemonicFile: process.env.MNEMONIC_FILE,
  nodeEnv: process.env.NODE_ENV,
  paymentHub: process.env.PAYMENT_HUB,
  paymentUrl: process.env.PAYMENT_URL,
  pgDatabase: process.env.PGDATABASE,
  pgHost: process.env.PGHOST,
  pgPassFile: process.env.PGPASSFILE,
  pgPort: process.env.PGPORT,
  pgUser: process.env.PGUSER,
  port: process.env.PORT,
  twitterBotAccessSecret: process.env.TWITTER_BOT_ACCESS_SECRET,
  twitterBotAccessToken: process.env.TWITTER_BOT_ACCESS_TOKEN,
  twitterAppAccessSecret: process.env.TWITTER_APP_ACCESS_SECRET,
  twitterAppAccessToken: process.env.TWITTER_APP_ACCESS_TOKEN,
  twitterBotUserId: process.env.TWITTER_BOT_USER_ID,
  twitterCallbackUrl: process.env.TWITTER_CALLBACK_URL,
  twitterConsumerKey: process.env.TWITTER_CONSUMER_KEY,
  twitterConsumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  twitterWebhookId: process.env.TWITTER_WEBHOOK_ID,
  telegramAppId: process.env.TELEGRAM_APP_ID,
  telegramAppHash: process.env.TELEGRAM_APP_HASH,
  telegramCommand: process.env.TELEGRAM_COMMAND,
};

const cfIndex = "25446";

@Injectable()
export class ConfigService {
  get ethProvider(): JsonRpcProvider {
    return new JsonRpcProvider(env.ethProvider);
  }

  public getWallet(index: number | string = cfIndex): Wallet {
    const mnemonic = fs.readFileSync(env.mnemonicFile, "utf8");
    console.log(`mnemonic ${mnemonic}`);
    return Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`).connect(this.ethProvider);
  }

  get env(): any {
    return env;
  }

  get paymentUrl(): string {
    return env.paymentUrl;
  }

  get discordToken(): any {
    return env.discordToken;
  }

  get discordId(): any {
    return env.discordId;
  }

  get telegramToken(): any {
    return env.telegramToken;
  }

  get telegramBotId(): any {
    return env.telegramBotId;
  }

  get wallet(): Wallet {
    return this.getWallet(0);
  }

  get logLevel(): number {
    return parseInt(env.logLevel, 10) || 4;
  }

  get isDevMode(): boolean {
    return env.nodeEnv === "development";
  }

  get callbacks(): any {
    return {
      twitter: env.twitterCallbackUrl,
    };
  }

  get port(): number { 
    return parseInt(env.port, 10) || 3000;
  }

  get webhooks(): any {
    return {
      twitter: {
        env: "test",
        id: env.twitterWebhookId,
        url: `${env.twitterCallbackUrl}/webhooks/twitter`,
      },
      telegram: {
        url: `${env.twitterCallbackUrl}/webhooks/telegram/${this.telegramToken}`,
      },
    };
  }

  get twitterApp(): TwitterConfig {
    return {
      accessSecret: env.twitterAppAccessSecret,
      accessToken: env.twitterAppAccessToken,
      ...this.twitterDev,
      // logger: new Logger('TwitterApp', this.logLevel),
    };
  }

  get twitterBot(): TwitterConfig {
    return {
      accessSecret: env.twitterBotAccessSecret,
      accessToken: env.twitterBotAccessToken,
      ...this.twitterDev,
      // logger: new Logger('TwitterBot', this.logLevel),
    };
  }

  get twitterDev(): TwitterConfig {
    return {
      callbackUrl: env.twitterCallbackUrl,
      consumerKey: env.twitterConsumerKey,
      consumerSecret: env.twitterConsumerSecret,
      // logger: new Logger('TwitterDev', this.logLevel),
      webhook: this.webhooks.twitter,
    };
  }

  get twitterBotUserId(): string {
    return env.twitterBotUserId;
  }

  get twitterHmac(): string {
    return env.twitterConsumerSecret;
  }

  get database(): PostgresConfig {
    return {
      database: env.pgDatabase,
      host: env.pgHost,
      password: fs.readFileSync(env.pgPassFile, "utf8"),
      port: parseInt(env.pgPort, 10),
      username: env.pgUser,
    };
  }

  get channel(): any {
    const mnemonic = fs.readFileSync(env.mnemonicFile, "utf8");
    return {
      ethProviderUrl: env.ethProvider,
      logLevel: 4,
      nodeUrl: env.paymentHub,
      signer: Wallet.fromMnemonic(mnemonic).privateKey,
    };
  }
}
