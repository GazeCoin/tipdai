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

export type PostgresConfig = {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};
