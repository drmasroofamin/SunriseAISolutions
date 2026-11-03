import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_STEPS, normalizeSpokenEmail, validateVoiceField } from '../shared/voice-flow.js';

test('asks the question first, then name, email and niche in order', () => {
  assert.deepEqual(VOICE_STEPS.map(step => step.key), ['requirement', 'name', 'email', 'niche']);
  assert.ok(VOICE_STEPS[0].prompt.includes('Welcome to SunriseAI'));
});
for (const [spoken, expected] of [
  ['Alex at example dot com', 'alex@example.com'],
  ['my email address is john dot smith at gmail dot com.', 'john.smith@gmail.com'],
  ['Pat underscore Jones at sign example hyphen shop dot com', 'pat_jones@example-shop.com'],
  ['alex plus sales at example dot org', 'alex+sales@example.org'],
]) test(`normalizes spoken email for review: ${spoken}`, () => assert.equal(normalizeSpokenEmail(spoken), expected));

test('requires complete details and a valid email, and rejects oversized/header-like input', () => {
  for (const key of ['requirement', 'name', 'email', 'niche']) assert.ok(validateVoiceField(key, ' '));
  assert.equal(validateVoiceField('name', 'Dr. Amina Rao'), '');
  assert.equal(validateVoiceField('email', 'visitor@example.com'), '');
  assert.equal(validateVoiceField('niche', 'Real estate agency'), '');
  assert.ok(validateVoiceField('email', 'visitor at example dot com'));
  assert.ok(validateVoiceField('email', 'a@example.com\r\nBcc: other@example.com'));
  assert.ok(validateVoiceField('name', 'x'.repeat(121)));
  assert.ok(validateVoiceField('niche', 'x'.repeat(201)));
  assert.ok(validateVoiceField('requirement', 'x'.repeat(2001)));
  assert.ok(validateVoiceField('name', 'test\0name'));
});
