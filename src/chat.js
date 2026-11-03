/** Keep only recent complete turns within the API's history budget. */
export function buildChatHistory(completed, text) {
  const history = completed.slice(-18).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
  history.push({ role: 'user', content: text.trim() });
  while (history.length > 1 && history.reduce((sum, message) => sum + message.content.length, 0) > 12000) history.splice(0, 2);
  return history;
}

export async function requestChatReply(messages, { fetchImpl = fetch, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messages }), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || typeof result?.reply !== 'string' || !result.reply.trim()) {
      const error = new Error('AI chat is unavailable.');
      const allowed = ['AI_NOT_CONFIGURED', 'AI_BUSY', 'AI_TIMEOUT', 'AI_UNAVAILABLE', 'AI_AUTH_FAILED', 'AI_MODEL_UNAVAILABLE', 'AI_QUOTA_EXCEEDED', 'RATE_LIMITED'];
      error.code = allowed.includes(result?.code) ? result.code : 'AI_UNAVAILABLE';
      throw error;
    }
    return { reply: result.reply, showLeadForm: result.showLeadForm === true, request: typeof result.request === 'string' ? result.request.slice(0, 2000) : '' };
  } finally { clearTimeout(timer); }
}
