import { Hono } from 'hono'

type Bindings = {
  SLACK_BOT_USER_OAUTH_TOKEN: string
}
const app = new Hono<{ Bindings: Bindings }>()

app.post('/', async(c) => {
  const req = await c.req.json()

  if (req.type === 'url_verification') {
    return c.text(req.challenge)
  }

  if (req.event.type === 'app_mention') {
    const token = c.env.SLACK_BOT_USER_OAUTH_TOKEN
    const channelId = req.event.channel
    const threadTs = req.event.thread_ts || req.event.ts
    const url = 'https://slack.com/api/chat.postMessage'
    const params = {
      channel: channelId,
      thread_ts: threadTs,
      text: 'hello',
    }
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
    return c.text("ok")
  }
})

export default app
