export const VOICE_STEPS = [
  { key: 'requirement', label: 'What would you like help with?', prompt: 'Welcome to SunriseAI! I’m your AI voice assistant. What would you like to automate, or what question can I help with?' },
  { key: 'name', label: 'Your name', prompt: 'I can help you explore that. First, may I have your name?' },
  { key: 'email', label: 'Contact email', prompt: 'Thank you. What email address should our team use if you choose to request a follow-up? You can type it for accuracy, or say at and dot. Please check it on screen before continuing.' },
  { key: 'niche', label: 'Company or business niche', prompt: 'What is your company or business niche? For example, real estate, a clinic, education, or e-commerce.' },
];

/** Recognition is fallible. The visitor must review this before it is used. */
export function normalizeSpokenEmail(value) {
  return value.trim().toLowerCase()
    .replace(/^(?:my\s+)?email(?:\s+address)?\s+is\s+/i, '')
    .replace(/\bat\s+sign\b/gi, '@').replace(/\bat\b/gi, '@')
    .replace(/\b(?:full\s+stop|dot|period)\b/gi, '.')
    .replace(/\bunderscore\b/gi, '_').replace(/\b(?:dash|hyphen)\b/gi, '-')
    .replace(/\bplus\b/gi, '+').replace(/\s+/g, '').replace(/[.!?]+$/, '');
}

export function validateVoiceField(key, value) {
  const limits = { requirement: 2000, name: 120, email: 254, niche: 200 };
  if (!Object.hasOwn(limits, key) || typeof value !== 'string' || !value.trim()) return 'Please enter an answer before continuing.';
  if (value.length > limits[key]) return `Please keep this answer under ${limits[key] + 1} characters.`;
  if (value.includes('\0') || (key !== 'requirement' && /[\r\n]/.test(value))) return 'Please use a single line for this answer.';
  if (key === 'email' && !/^[^\s@<>,;"\r\n]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim())) return 'Please check your email address, including the @ sign and domain.';
  return '';
}
