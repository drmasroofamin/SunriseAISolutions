export async function requestVoiceSolution(fields, { fetchImpl = fetch, timeoutMs = 30000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/voice/solution', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ requirement: fields.requirement, niche: fields.niche }),
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    });
    const result = await response.json();
    if (!response.ok || typeof result?.reply !== 'string' || !result.reply.trim()) {
      const error = new Error('Voice consultation is unavailable.');
      const codes = ['AI_NOT_CONFIGURED', 'AI_AUTH_FAILED', 'AI_QUOTA_EXCEEDED', 'AI_MODEL_UNAVAILABLE', 'AI_BUSY', 'RATE_LIMITED', 'AI_TIMEOUT'];
      error.code = codes.includes(result?.code) ? result.code : 'AI_UNAVAILABLE';
      throw error;
    }
    return result.reply;
  } finally { clearTimeout(timer); }
}
