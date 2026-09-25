import {
  cleanRules,
  defaultRule,
  hitPolicyBadge,
  newExpression,
  normalizeDefinition,
  operatorDisabled,
  operatorsFor,
  validateDefinition,
} from './decision-table-model';

describe('decision table model', () => {
  it('normalizes an empty definition like the original editor', () => {
    const def = normalizeDefinition({});
    expect(def.hitIndicator).toBe('FIRST');
    expect(def.inputExpressions).toHaveLength(1);
    expect(def.outputExpressions).toHaveLength(1);
    expect(def.inputExpressions?.[0].id).toBe('1');
    expect(def.outputExpressions?.[0].id).toBe('2');
    expect(def.rules).toEqual([{ '1_operator': '==', '1_expression': '-', '2': '' }]);
  });

  it('fills missing operators on loaded rules', () => {
    const def = normalizeDefinition({
      inputExpressions: [{ id: '1' }],
      outputExpressions: [{ id: '2' }],
      rules: [{ '1_expression': '> 3', '2': 'a' }],
    });
    expect(def.rules?.[0]['1_operator']).toBe('==');
  });

  it('continues column ids after the highest one', () => {
    expect(
      newExpression({ inputExpressions: [{ id: '4' }], outputExpressions: [{ id: '9' }] }).id,
    ).toBe('10');
  });

  it('keeps only cells that belong to a column when saving', () => {
    const def = {
      inputExpressions: [{ id: '1' }],
      outputExpressions: [{ id: '3' }],
      rules: [{ '1_operator': '<', '1_expression': '5', '2_expression': 'stale', '3': 'x' }],
    };
    expect(cleanRules(def)).toEqual([{ '1_operator': '<', '1_expression': '5', '3': 'x' }]);
    expect(defaultRule(def)).toEqual({ '1_operator': '==', '1_expression': '-', '3': '' });
  });

  it('shows the hit policy badge with the collect symbol', () => {
    expect(hitPolicyBadge({ hitIndicator: 'UNIQUE' })).toBe('U');
    expect(hitPolicyBadge({ hitIndicator: 'COLLECT', collectOperator: 'SUM' })).toBe('C+');
    expect(hitPolicyBadge({})).toBe('F');
  });

  it('offers operators by type and disables them for "any" and custom values', () => {
    expect(operatorsFor('boolean')).toEqual(['==', '!=']);
    expect(operatorsFor('collection')).toContain('ANY OF');
    expect(operatorDisabled('==', '-')).toBe(true);
    expect(operatorDisabled(null, '${amount > 5}')).toBe(true);
    expect(operatorDisabled('IS IN', '-')).toBe(false);
    expect(operatorDisabled('==', '5')).toBe(false);
  });

  it('reports columns without a variable', () => {
    expect(validateDefinition({ inputExpressions: [{ id: '1' }] })).toEqual(['missing-variable']);
    expect(validateDefinition({ inputExpressions: [{ id: '1', variableId: 'a' }] })).toEqual([]);
  });
});
