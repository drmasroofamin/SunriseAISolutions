import { pathToFileURL } from 'node:url';
import { classifyOpenAIError } from '../server/openai-error.js';

const guidance = {
  AI_AUTH_FAILED: 'OpenAI rejected access. Check the key, its project permissions, and model access.',
  AI_QUOTA_EXCEEDED: 'Check OpenAI Platform Billing balance and the project limits for this key. ChatGPT subscriptions do not include API credits.',
  AI_BUSY: 'OpenAI returned a request or token limit. Check the project Limits page and wait for the limit to reset; repeated retries will not resolve a quota problem.',
  AI_MODEL_UNAVAILABLE: 'The selected model is unavailable to this project. Check OPENAI_MODEL and its model access.',
  AI_UNAVAILABLE: 'The request did not complete. Check the selected model and OpenAI service status.',
};

export async function checkAI({ env = process.env, testRequest = false, fetchImpl = fetch, timeoutMs = 25000, log = console.log } = {}) {
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
  log('This check never prints your key, chat messages, or raw provider errors.');
  if (!key) {
    log('FAIL: AI_NOT_CONFIGURED. Set OPENAI_API_KEY privately in .env.server.local, then restart npm run dev.');
    return false;
  }
  log('PASS: an OpenAI key is configured. This does not verify API access or billing.');
  if (!testRequest) {
    log('No API call made. To diagnose access and quota, run npm run ai:check -- --test. This makes one small, potentially billable generation request (at most 16 output tokens).');
    return true;
  }

  log('Making one small OpenAI generation test (at most 16 output tokens); API usage may be charged. No visitor conversation is sent.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: 'Reply with exactly the word READY.', max_output_tokens: 16, store: false }),
      signal: controller.signal,
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) {
      const failure = classifyOpenAIError(response.status, body);
      log(`FAIL: HTTP ${response.status}; ${failure.code}; provider code: ${failure.providerCode}; provider type: ${failure.providerType}.`);
      log(guidance[failure.code] || guidance.AI_UNAVAILABLE);
      return false;
    }
    const hasText = Array.isArray(body?.output) && body.output.some(item => item?.type === 'message' && item.role === 'assistant' && Array.isArray(item.content) && item.content.some(part => part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()));
    if (!hasText || body?.error || (body?.status && body.status !== 'completed')) {
      log('FAIL: AI_UNAVAILABLE. OpenAI returned no completed text reply.');
      return false;
    }
    log('PASS: OpenAI accepted the test request and returned an AI reply.');
    log('Restart npm run dev to load the current key and model, then try the assistant once.');
    return true;
  } catch (error) {
    if (controller.signal.aborted) log('FAIL: AI_TIMEOUT. The OpenAI connection exceeded the test deadline.');
    else if (['ENOTFOUND', 'EAI_AGAIN'].includes(error?.cause?.code)) log('FAIL: DNS_FAILED. This computer could not resolve api.openai.com.');
    else log('FAIL: CONNECTION_FAILED. Check this computer’s HTTPS connection to api.openai.com. TLS verification remains enabled.');
    return false;
  } finally { clearTimeout(timer); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await checkAI({ testRequest: process.argv.includes('--test') }) ? 0 : 1; }
  catch { console.error('FAIL: AI check could not run. Confirm the project is updated and Node.js 24 is installed.'); process.exitCode = 1; }
}
