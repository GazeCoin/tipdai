import { Message, User } from 'telegram-typings';

export type TwitterConfig = {
  accessToken?: string;
  accessSecret?: string;
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
  log?: any;
  webhook: {
    env: string;
    id: string;
    url: string;
  };
};

export type TelegramConfig = {
  botToken?: string;
  log?: any;
  webhookUrl: string;
};

// telegram-typings might add this one day
export type TelegramMessage = Message & { via_bot?: User}

export type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};
