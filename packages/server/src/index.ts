import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { Message, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateSystemPrompt } from './prompts';
import * as tools from "./tools"

const api = new Hono().basePath('/api');

interface ChatRequest {
  messages: Message[]
}

api.post('/chat/stream', async (c) => {
  let { messages } = await c.req.json() as ChatRequest;
  c.header('X-Vercel-AI-Data-Stream', 'v1');
  c.header('Content-Type', 'text/plain; charset=utf-8');

  const systemPrompt = generateSystemPrompt();
  messages = messages.filter((message) => message.role !== 'system');

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    tools,
  });

  return stream(c, (stream) => stream.pipe(result.toDataStream()));
});

export default {
  port: 4111,
  fetch: api.fetch,
} 