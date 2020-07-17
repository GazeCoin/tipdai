# Notes on Telegram bot configuration for TipDai

## Creating your bot

The BotFather (https://t.me/BotFather) is a bot that can create and edit bots. 

Many of the settings are yours to decide. Some have dependencies in the code. In particular, note these:
- Inline mode. Must be on. The placeholder will lhelp users know the expected format. The suggested placeholder is `@username 99.99`
- Inline feedback. Turn it on and set to 100%. Send instructions generated in line mode rely on these messages.
- Make a note of your token, and keep it secret.

## Server setup

Telegram messages will be sent to the service via webhooks. The webhook is created on the first startup of the Telegram service, and stays up permanently. Webhook endpoints need to be enabled, with reverse proxy settings to forward requests to the service. The endpoint used is https://<your domain>/webhooks/telegram/<token>
Since the token is secret, requests other than genuine requests from Telegram will have an invalid token. The service will reject these with a 400 error. The API does require SSL certificates, but self-signed certificates are acceptable.

The Telegram API is based on REST calls. See here https://core.telegram.org/bots/api for details. Manual actions such as deleting the webhooks can be achieved using Postman or curl. 


## Privacy and security

The bot will work with minimal permissions. If an admin invites the bot to a channel and grants it permissions, it will see channel messages, but does not rely on these for triggering actions. In public chats, inline-mode messages and responses are used to trigger actions. Channel messages would allow messages to be edited, replies made, etc. for status reporting.  (currently disabled).

