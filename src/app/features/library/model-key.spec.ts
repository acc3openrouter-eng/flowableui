import { MODEL_KEY_PATTERN, suggestKey } from './model-key';

describe('suggestKey', () => {
  it('camel-cases words', () => {
    expect(suggestKey('Invoice approval process')).toBe('invoiceApprovalProcess');
  });

  it('drops accents, punctuation and leading digits', () => {
    expect(suggestKey('  2nd Café review!  ')).toBe('ndCafeReview');
  });

  it('always produces a valid key or an empty string', () => {
    for (const name of ['Hello world', '123', 'a-b_c', 'Ünïcödé', '']) {
      const key = suggestKey(name);
      expect(key === '' || MODEL_KEY_PATTERN.test(key)).toBe(true);
    }
  });
});
