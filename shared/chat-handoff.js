export const BOOKING_URL = 'https://calendly.com/sunrisesolution93/30min';

const SERVICES = /\b(?:ai|bots?|chatbots?|whatsapp|voice agents?|voice assistants?|workflow|automation|automations|automate|software|llm|rag|crm|n8n|zapier|lead generation|sales outreach|data analytics|machine learning)\b/i;
const INTEREST = /\b(?:need|want|would like|looking for|interested in|build|create|develop|automate|set up|setup|integrate|help me|help us|hire|quote|pricing|cost|buy|get started)\b/i;
const INFORMATIONAL = /^(?:what (?:is|are)|how (?:does|do|to)|explain|tell me about|can you explain|what(?:'s| is) the difference)\b/i;
const PERSONAL_INTEREST = /\b(?:i|we)\s+(?:need|want|would like|am looking for|are looking for|am interested in|are interested in)\b/i;
const NEGATED_INTEREST = /\b(?:(?:do not|don't|dont)\s+(?:need|want)|not\s+(?:interested|looking for))\b/i;
const DIRECT_CONTACT = /\b(?:(?:book|schedule|arrange)\s+(?:a |an |my |our |your )?(?:call|meeting|appointment)|(?:contact|call)\s+(?:me|us)|(?:speak|talk)\s+(?:to|with)\s+(?:a |the |your )?(?:team|person|human|someone))\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function hasSolutionIntent(content) {
  const text = content.trim();
  if (NEGATED_INTEREST.test(text) && !/\bbut\b/i.test(text)) return false;
  if (/^(?:discuss my goals|automate my workflow)[.!?]?$/i.test(text)) return true;
  if (DIRECT_CONTACT.test(text)) return true;
  if (!SERVICES.test(text)) return false;
  if (INFORMATIONAL.test(text) && !PERSONAL_INTEREST.test(text) && !/\b(?:quote|pricing|cost)\b/i.test(text)) return false;
  if (INTEREST.test(text)) return true;
  // A direct solution phrase is also a request, even without "I need".
  return /^(?:(?:an?|the)\s+)?(?:ai\s+)?(?:(?:whatsapp|website|instagram|customer support)\s+)?(?:chatbots?|bots?|voice agents?)(?:\s+for\b[^.!?]*)?[.!?]?$/i.test(text);
}

function topicFor(content) {
  if (/\bwhatsapp\b/i.test(content)) return 'your WhatsApp bot';
  if (/\b(?:voice|calling|receptionist)\b/i.test(content)) return 'your AI voice agent';
  if (/\b(?:bot|chatbot)s?\b/i.test(content)) return 'your AI bot';
  if (/\b(?:automate|automation|workflow)\b/i.test(content)) return 'your automation project';
  return 'your requirements';
}

/** Guaranteed booking-first handoff; no model call or contact delivery happens here. */
export function getChatHandoff(messages) {
  if (!Array.isArray(messages)) return null;
  const latest = messages.at(-1);
  if (latest?.role !== 'user' || typeof latest.content !== 'string' || !latest.content.trim()) return null;
  const request = latest.content.trim();
  const previous = messages.at(-2);
  if (EMAIL.test(request) && previous?.role === 'assistant' && typeof previous.content === 'string' && previous.content.includes(BOOKING_URL)) {
    const original = [...messages.slice(0, -1)].reverse().find(message => message?.role === 'user' && typeof message.content === 'string' && hasSolutionIntent(message.content));
    return {
      reply: `Please use the contact form below to send your email and company/niche to our team. Typing them into chat has not sent an enquiry. You can also book a free call at a time that suits you: ${BOOKING_URL}`,
      showLeadForm: true,
      request: original?.content.trim() || 'Follow-up requested through Sunrise assistant',
    };
  }
  if (!hasSolutionIntent(request)) return null;
  return {
    reply: `Let’s discuss ${topicFor(request)} with our team. Book a free strategy call at a time that suits you: ${BOOKING_URL}\n\nOr share your email and company/niche using the contact form below. Your name is optional. Submit the form so our team can follow up directly.`,
    showLeadForm: true,
    request,
  };
}
