import { validateChatBody, estimateTokens, estimatePromptTokens } from '../bounds.ts';

const SCAN = '11111111-1111-1111-1111-111111111111';

describe('validateChatBody', () => {
  it('accepts a well-formed body and returns only typed fields', () => {
    const r = validateChatBody({
      scanId: SCAN, message: 'hi', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }],
    });
    expect(r).toEqual({
      ok: true,
      value: { scanId: SCAN, message: 'hi', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] },
    });
  });

  it('accepts a prior assistant reply longer than the 2,000-char message limit (a 600-token reply)', () => {
    const r = validateChatBody({ scanId: SCAN, message: 'hi', history: [{ role: 'assistant', content: 'a'.repeat(2500) }] });
    expect(r.ok).toBe(true);
  });

  it('defaults a missing history to empty', () => {
    expect(validateChatBody({ scanId: SCAN, message: 'hi' })).toEqual({ ok: true, value: { scanId: SCAN, message: 'hi', history: [] } });
  });

  it.each([
    ['non-object', 'x'],
    ['null', null],
    ['missing scanId', { message: 'hi' }],
    ['non-uuid scanId', { scanId: 'abc', message: 'hi' }],
    ['empty message', { scanId: SCAN, message: '   ' }],
    ['non-string message', { scanId: SCAN, message: 5 }],
    ['oversized message', { scanId: SCAN, message: 'a'.repeat(2001) }],
    ['history not array', { scanId: SCAN, message: 'hi', history: {} }],
    ['21 history turns', { scanId: SCAN, message: 'hi', history: Array(21).fill({ role: 'user', content: 'a' }) }],
    ['system role turn', { scanId: SCAN, message: 'hi', history: [{ role: 'system', content: 'a' }] }],
    ['turn with non-string content', { scanId: SCAN, message: 'hi', history: [{ role: 'user', content: [{ type: 'image' }] }] }],
    ['turn with empty content', { scanId: SCAN, message: 'hi', history: [{ role: 'user', content: '' }] }],
    ['oversized turn', { scanId: SCAN, message: 'hi', history: [{ role: 'assistant', content: 'a'.repeat(4001) }] }],
    ['turn with extra keys', { scanId: SCAN, message: 'hi', history: [{ role: 'user', content: 'a', image: 'data:' }] }],
    ['client-supplied userId', { scanId: SCAN, message: 'hi', userId: 'someone-else' }],
    ['client-supplied price', { scanId: SCAN, message: 'hi', price: 0 }],
  ])('rejects %s', (_label, body) => {
    expect(validateChatBody(body)).toEqual({ ok: false });
  });
});

describe('token estimate', () => {
  it('is conservative (ceil of chars/3)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(2);
  });
  it('counts system, every history turn and the new message with per-turn overhead', () => {
    const t = estimatePromptTokens('s'.repeat(30), [{ role: 'user', content: 'a'.repeat(30) }, { role: 'assistant', content: 'b'.repeat(30) }]);
    expect(t).toBe(10 + (10 + 4) * 2 + 8);
  });
  it('twenty long turns exceed the 3,000-token cap', () => {
    const turns = Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(2000) } as const));
    expect(estimatePromptTokens('sys', turns)).toBeGreaterThan(3000);
  });
});
