import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_URL, getChatHandoff } from '../shared/chat-handoff.js';

for (const request of [
  'I need an AI bot for WhatsApp', 'AI bot for WhatsApp', 'WhatsApp chatbot',
  'Build an AI bot', 'Can you build a WhatsApp bot?', 'We want a voice agent',
  'I am interested in workflow automation', 'Automate my workflow', 'Discuss my goals',
  'Help me automate CRM updates', 'We are looking for custom software', 'How much does an AI bot cost?',
  'Please book a call', 'I want to speak to your team', 'Contact me',
]) {
  test(`immediately offers booking and explicit lead submission for: ${request}`, () => {
    const result = getChatHandoff([{ role: 'user', content: request }]);
    assert.equal(result.showLeadForm, true);
    assert.equal(result.request, request);
    assert.ok(result.reply.includes(BOOKING_URL));
    assert.ok(result.reply.includes('email and company/niche'));
    assert.ok(result.reply.includes('Submit the form'));
    assert.ok(!result.reply.includes('appointment is booked'));
  });
}

for (const content of ['What is a chatbot?', 'How does a voice agent work?', 'Tell me about RAG', 'How to build a WhatsApp bot?', 'What are your opening hours?', 'Who is the founder?', "I don't want a chatbot", 'I am not interested in an AI bot', 'Hello']) {
  test(`leaves an informational or unrelated message to the AI: ${content}`, () => {
    assert.equal(getChatHandoff([{ role: 'user', content }]), null);
  });
}

test('follow-up email after a handoff stays out of the model and does not claim delivery', () => {
  const first = getChatHandoff([{ role: 'user', content: 'I need a WhatsApp bot' }]);
  const result = getChatHandoff([
    { role: 'user', content: 'I need a WhatsApp bot' },
    { role: 'assistant', content: first.reply },
    { role: 'user', content: 'alex@example.com, real estate' },
  ]);
  assert.equal(result.request, 'I need a WhatsApp bot');
  assert.equal(result.showLeadForm, true);
  assert.ok(result.reply.includes('has not sent an enquiry'));
});

test('prior sales interest does not hijack an unrelated latest question', () => {
  assert.equal(getChatHandoff([
    { role: 'user', content: 'I need a bot' },
    { role: 'assistant', content: BOOKING_URL },
    { role: 'user', content: 'What is RAG?' },
  ]), null);
});

test('invalid history and assistant-ending history do not trigger a handoff', () => {
  for (const input of [null, {}, [], [{ role: 'assistant', content: 'I need an AI bot' }], [{ role: 'user', content: null }]]) assert.equal(getChatHandoff(input), null);
});
