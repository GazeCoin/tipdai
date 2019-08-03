const crypto = require('crypto')
const express = require('express')

const { config } = require('./config')
const { handleTweet, handleMessage } = require('./events')

const app = express()

const port = process.env.PORT || '8080'

app.use(express.json())

app.use((req, res, next) => {
  console.log(`=> ${req.method} ${req.path} -- ${JSON.stringify(req.query)}`)
  if (JSON.stringify(req.body) !== "{}") {
    if (req.path === '/webhooks/twitter') {
      const keys = Object.keys(req.body).filter(key => key !== 'for_user_id')
      console.log(`Events: ${JSON.stringify(keys)}`)
    } else {
      console.log(`Body: ${JSON.stringify(req.body)}`)
    }
  }
  next()
})

app.get('/webhooks/twitter', (req, res, next) => {
  const hmac = crypto.createHmac('sha256', config.hmac).update(req.query.crc_token);
  const response_token = `sha256=${hmac.digest('base64')}`
  console.log(`Got CRC, responding with: ${response_token}`)
  res.status(200).json({ response_token })
})

app.post('/webhooks/twitter', (req, res, next) => {
  if (req.body.tweet_create_events) {
    req.body.tweet_create_events.forEach(handleTweet)
  }
  if (req.body.direct_message_events) {
    req.body.direct_message_events.forEach(handleMessage)
  }
})

app.all('*', (req, res) => {
  res.status(200).send('Cool story, Bro')
})

app.listen(port, () => {
  console.log(`TipDai app listening on ${port}`)
})
