import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './prompts.ts';

describe('System Prompt', () => {
  const prompt = buildSystemPrompt('2026-10-10');

  it('contains the exact page names', () => {
    const requiredPages = [
      'Dashboard',
      'Study',
      'Finance (Money)',
      'Habits',
      'Goals',
      'Forecasting (ML)',
      'Simulation',
    ];
    for (const page of requiredPages) {
      assert.equal(prompt.includes(page), true, `Prompt should contain exact page name: ${page}`);
    }
  });

  it('contains the plain-text rule', () => {
    assert.match(prompt, /PLAIN TEXT ONLY/i);
    assert.match(prompt, /Never use Markdown/i);
  });

  it('contains the write preparation rule and safety directives', () => {
    assert.match(prompt, /PREPARATION ONLY/i);
    assert.match(prompt, /I've prepared this; please confirm below/i);
    assert.match(prompt, /propose_entry or propose_delete ONLY when/i);
    assert.match(prompt, /sign_in_required/i);
    assert.match(prompt, /Indian Rupees/i);
    assert.match(prompt, /₹/);
  });

  it('injects client date and weekday', () => {
    assert.match(prompt, /2026-10-10/);
    assert.match(prompt, /Saturday/);
  });
});
