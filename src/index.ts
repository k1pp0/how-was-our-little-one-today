import { Hono } from 'hono'

type Bindings = {
  SLACK_BOT_USER_OAUTH_TOKEN: string
}
const app = new Hono<{ Bindings: Bindings }>()

interface SlackMessage {
  type: string;
  user: string;
  text: string;
  thread_ts: string;
  reply_count?: number;
  subscribed?: boolean;
  last_read?: string;
  unread_count?: number;
  ts: string;
  parent_user_id?: string;
}

interface SlackConversationsRepliesResponse {
  messages: SlackMessage[];
  has_more: boolean;
  ok: boolean;
  response_metadata: {
    next_cursor: string;
  }
}

app.post('/', async(c) => {
  const req = await c.req.json()

  if (req.type === 'url_verification') {
    return c.text(req.challenge)
  }

  if (req.event.type === 'app_mention') {
    const token: string = c.env.SLACK_BOT_USER_OAUTH_TOKEN
    const channelId: string = req.event.channel
    const threadTs: string = req.event.thread_ts || req.event.ts

    const messages = await slackConversationsReplies(
      token, channelId, threadTs
    )

    await slackChatPostMessage(
      token, channelId, threadTs, `hello: ${messages.length}`
    )

    return c.text("ok")
  }
})

export default app

async function slackChatPostMessage(token: string, channelId: string, threadTs: string, text: string){
  const url = 'https://slack.com/api/chat.postMessage'
  const params = {
    channel: channelId,
    thread_ts: threadTs,
    text: text,
  }
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
}

async function slackConversationsReplies(token: string, channelId: string, threadTs: string): Promise<SlackMessage[]> {
  const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${threadTs}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  const data: SlackConversationsRepliesResponse = await response.json()
  return data.messages
}
