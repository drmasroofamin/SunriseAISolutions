/** A timeout is ambiguous: never retry a submission automatically. */
export async function submitEnquiry(fields, { fetchImpl = fetch, timeoutMs = 30000, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(fields),
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    });
    const result = await response.json();
    if (!response.ok || result?.accepted !== true) {
      const error = new Error('Submission could not be confirmed.');
      if (result?.code === 'MAIL_NOT_CONFIGURED') error.code = 'MAIL_NOT_CONFIGURED';
      throw error;
    }
    return { accepted: true };
  } finally {
    clearTimeout(timer);
  }
}

/** Fallbacks use the same visible enquiry; no draft is stored on this device. */
export function buildEmailDraft(recipient, fields) {
  const subject = `SunriseAI enquiry${fields.company ? `: ${fields.company}` : ''}`;
  const body = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Company: ${fields.company}`,
    `Service: ${fields.service}`,
    '',
    fields.message,
  ].join('\n');
  const query = new URLSearchParams({ view: 'cm', fs: '1', to: recipient, su: subject, body });
  return {
    mailto: `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    gmail: `https://mail.google.com/mail/?${query.toString()}`,
  };
}
