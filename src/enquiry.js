/** A timeout is ambiguous: never retry a submission automatically. */
export async function submitEnquiry(recipient, fields, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...fields,
        _subject: 'New SunriseAI website enquiry',
        _template: 'table',
        _replyto: fields.email,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error('Submission could not be confirmed.');
    const result = await response.json();
    // Activation and verification are provider prerequisites, not delivery success.
    const needsActivation = /activat|confirm your email|verify your email|check your email/i.test(result?.message || '');
    if ((result?.success !== true && result?.success !== 'true') || needsActivation) {
      throw new Error('Submission could not be confirmed.');
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
