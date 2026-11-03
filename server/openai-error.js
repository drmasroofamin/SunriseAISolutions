const SAFE_CODES = new Set([
  'rate_limit_exceeded', 'insufficient_quota', 'billing_hard_limit_reached',
  'billing_not_active', 'invalid_api_key', 'model_not_found', 'permission_denied',
  'organization_deactivated', 'project_archived',
]);
const SAFE_TYPES = new Set([
  'invalid_request_error', 'insufficient_quota', 'billing_hard_limit_reached',
  'billing_not_active', 'requests', 'tokens', 'rate_limit_exceeded', 'server_error',
]);
const QUOTA_ERRORS = new Set(['insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active']);

/** Only fixed, known labels may leave the provider boundary. Never return its message. */
export function classifyOpenAIError(httpStatus, body) {
  const error = body?.error;
  const providerCode = SAFE_CODES.has(error?.code) ? error.code : 'unrecognized';
  const providerType = SAFE_TYPES.has(error?.type) ? error.type : 'unrecognized';
  let status = 502;
  let code = 'AI_UNAVAILABLE';
  if (httpStatus === 401 || httpStatus === 403) {
    status = 503;
    code = 'AI_AUTH_FAILED';
  } else if (httpStatus === 404 && providerCode === 'model_not_found') {
    status = 503;
    code = 'AI_MODEL_UNAVAILABLE';
  } else if (httpStatus === 429) {
    const quotaExceeded = QUOTA_ERRORS.has(providerCode) || QUOTA_ERRORS.has(providerType);
    status = quotaExceeded ? 503 : 429;
    code = quotaExceeded ? 'AI_QUOTA_EXCEEDED' : 'AI_BUSY';
  }
  return { status, code, providerCode, providerType };
}
