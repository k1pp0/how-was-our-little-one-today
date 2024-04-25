import { Hono } from "hono";

type Bindings = {
	SLACK_BOT_USER_OAUTH_TOKEN: string;
	OPENAI_API_SECRET_KEY: string;
	OPENAI_API_ENDPOINT: string;
	PROMPT: string;
};
const app = new Hono<{ Bindings: Bindings }>();

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
	};
}

interface AiChatCompletionsResponse {
	id: string;
	model: string;
	created: number;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	object: string;
	choices: {
		index: number;
		finish_reason: string;
		message: {
			role: string;
			content: string;
		};
		delta: {
			role: string;
			content: string;
		};
	}[];
}

app.post("/", async (c) => {
	const req = await c.req.json();

	if (req.type === "url_verification") {
		return c.text(req.challenge);
	}

	if (req.event.type === "app_mention") {
		// slack info
		const token: string = c.env.SLACK_BOT_USER_OAUTH_TOKEN;
		const channelId: string = req.event.channel;
		const threadTs: string = req.event.thread_ts || req.event.ts;
		const botUser: string = req.event.text.match(/<@([A-Z0-9]+)>/)[1];
		// openai info
		const apiKey: string = c.env.OPENAI_API_SECRET_KEY;
		const endPoint: string = c.env.OPENAI_API_ENDPOINT;
		const prompt: string = c.env.PROMPT;

		// main logic
		c.executionCtx.waitUntil(
			main(token, channelId, threadTs, botUser, apiKey, endPoint, prompt),
		);

		return c.text("ok");
	}
});

export default app;

async function main(
	token: string,
	channelId: string,
	threadTs: string,
	botUser: string,
	apiKey: string,
	endPoint: string,
	prompt: string,
): Promise<void> {
	const messages = await slackConversationsReplies(token, channelId, threadTs);
	const messageText: string = messages
		.filter(
			(message) => message.user !== botUser && !message.text.includes(botUser),
		)
		.sort((a, b) => a.ts.localeCompare(b.ts))
		.map((message) => message.text)
		.join(",");

	const resultText = await aiChatCompletions(
		apiKey,
		endPoint,
		messageText,
		prompt,
	);

	await slackChatPostMessage(token, channelId, threadTs, resultText);
}

async function slackChatPostMessage(
	token: string,
	channelId: string,
	threadTs: string,
	text: string,
) {
	const url = "https://slack.com/api/chat.postMessage";
	const params = {
		channel: channelId,
		thread_ts: threadTs,
		text: text,
	};
	await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(params),
	});
}

async function slackConversationsReplies(
	token: string,
	channelId: string,
	threadTs: string,
): Promise<SlackMessage[]> {
	const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${threadTs}`;
	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	const data: SlackConversationsRepliesResponse = await response.json();
	return data.messages;
}

async function aiChatCompletions(
	apiKey: string,
	endPoint: string,
	messageText: string,
	prompt: string,
): Promise<string> {
	const params = {
		model: "gpt-3.5-turbo",
		messages: [
			{ role: "system", content: prompt },
			{ role: "user", content: messageText },
		],
	};
	const response = await fetch(`${endPoint}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(params),
	});
	const data: AiChatCompletionsResponse = await response.json();
	return data.choices[0].message.content;
}
