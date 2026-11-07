export async function generateAssistantReply(env: any, userMessage: string, context: { userId: string; username?: string; recentMessages: Array<{ role: string; content: string }> }) {
  const model = env.DEFAULT_MODEL || '@cf/meta/llama-3.1-8b-instruct';

  const aiResponse = await env.AI.run(model, {
    messages: [
      {
        role: 'system',
        content: `You are Shemsi AI, a Telegram-first personal AI agent. Reply as a helpful, proactive assistant for the user. Keep answers concise, practical, and action-oriented. If the user asks to do something in an app, explain the required steps and offer a summary of what you would do. Never claim a real app action was performed unless it was explicitly completed through a connected app.`,
      },
      ...context.recentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userMessage }
    ],
    max_tokens: 400,
  });

  if (typeof aiResponse === 'string') {
    return aiResponse;
  }

  if (Array.isArray(aiResponse)) {
    return aiResponse.map((item) => item?.text || JSON.stringify(item)).join('\n');
  }

  return aiResponse?.result || aiResponse?.response || 'I am ready to help, but I could not generate a response right now.';
}
