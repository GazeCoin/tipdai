import { Injectable } from '@nestjs/common';
import qs from 'qs';

import { ConfigService } from '../config/config.service';

import { Twitter } from './client';

/*
const bohendo_id = '259539164'
const tipdai_id = '1154313992141099008'
*/

@Injectable()
export class TwitterService {
  private twitter: any;
  private twitterDev: any;

  constructor(private readonly config: ConfigService) {
    this.twitter = new Twitter(this.config.twitterBot);
    this.twitterDev = new Twitter(this.config.twitterDev);
  }

  private handleError = reject => (error, response, body) => {
    console.error(`Failure!`);
    console.error(`body: ${body}`);
    return reject(error);
  }

  public getSubscriptions = () => {
    return new Promise((resolve, reject) => {
      this.twitterDev.getCustomApiCall(
        `/account_activity/all/${this.config.webhook.env}/subscriptions/list.json`,
        {},
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = JSON.parse(res);
          console.log(`Got subscriptions: ${JSON.stringify(data, null, 2)}`);
          resolve(data);
        },
      );
    });
  }

  public subscribe = () => {
    return new Promise((resolve, reject) => {
      this.twitter.postCustomApiCall(
        `/account_activity/all/${this.config.webhook.env}/subscriptions.json`,
        JSON.stringify({}),
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = JSON.parse(res);
          console.log(`Subscribed: ${JSON.stringify(data, null, 2)}`);
          resolve(data);
        },
      );
    });
  }

  public activateWebhook = () => {
    return new Promise((resolve, reject) => {
      this.twitter.activateWebhook(
        {
          env: this.config.webhook.env,
          url: this.config.webhook.url,
        },
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = JSON.parse(res);
          console.log(`Activated webhook: ${JSON.stringify(data, null, 2)}`);
          resolve(data);
        },
      );
    });
  }

  public triggerCRC = () => {
    return new Promise((resolve, reject) => {
      const { env, id } = this.config.webhook;
      this.twitter.triggerCRC({ env, webhookId: id }, this.handleError(reject), res => {
        console.log(`Success fully triggered a CRC!`);
        resolve();
      });
    });
  }

  public tweet = status => {
    return new Promise((resolve, reject) => {
      this.twitter.postTweet({ status }, this.handleError(reject), res => {
        console.log(`Success!`);
        const data = JSON.parse(res);
        console.log(`Sent tweet: ${JSON.stringify(data, null, 2)}`);
        resolve(data);
      });
    });
  }

  public getMentions = options => {
    return new Promise((resolve, reject) => {
      const defaults = { count: '5', trim_user: true, include_entities: true };
      this.twitter.getMentionsTimeline(
        { ...defaults, ...options },
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = JSON.parse(res);
          const mentions = data.map(tweet => tweet.text);
          console.log(`Got mentions: ${JSON.stringify(mentions, null, 2)}`);
          resolve(data);
        },
      );
    });
  }

  public getUser = (screen_name) => {
    return new Promise((resolve, reject) => {
      this.twitter.getCustomApiCall(
        '/users/lookup.json',
        { screen_name },
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = JSON.parse(res);
          console.log(`Got user: ${JSON.stringify(data, null, 2)}`);
          resolve(data);
        },
      );
    });
  }

  public sendDM = (recipient_id, message) => {
    return new Promise((resolve, reject) => {
      this.twitter.postCustomApiCall(
        '/direct_messages/events/new.json',
        JSON.stringify({
          event: {
            type: 'message_create',
            message_create: {
              target: {
                recipient_id,
              },
              message_data: {
                text: message,
              },
            },
          },
        }),
        this.handleError(reject),
        data => {
          console.log(`Success!`);
          console.log(`Sent DM: ${data}`);
          resolve(data);
        },
      );
    });
  }

  public authorize = () => {
    return new Promise((resolve, reject) => {
      this.twitter.authorize(
        { oauthCallback: 'https://tipdai.bohendo.com' },
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = qs.parse(res);
          console.log(`Got auth data: ${JSON.stringify(data)}`);
          const baseUrl = 'https://api.twitter.com/oauth/authorize';
          console.log(`Login at: ${baseUrl}?oauth_token=${data.oauth_token}`);
          resolve(data);
        },
      );
    });
  }

  public getAccessToken = (consumer_key, token, verifier) => {
    return new Promise((resolve, reject) => {
      this.twitter.getAccessToken(
        {
          oauth_consumer_key: consumer_key,
          oauth_token: token,
          oauth_verifier: verifier,
        },
        this.handleError(reject),
        res => {
          console.log(`Success!`);
          const data = qs.parse(res);
          console.log(`Got access token: ${JSON.stringify(data)}`);
          resolve(data);
        },
      );
    });
  }

}