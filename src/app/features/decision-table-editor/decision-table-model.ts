import {
  DecisionTableDefinition,
  DecisionTableExpression,
  DecisionTableRule,
} from '../../core/api/api.types';

export const HIT_POLICIES = [
  'FIRST',
  'ANY',
  'UNIQUE',
  'PRIORITY',
  'RULE ORDER',
  'OUTPUT ORDER',
  'COLLECT',
] as const;

/** Collect operators and the symbol shown after the "C" hit policy badge. */
export const COLLECT_OPERATORS: Record<string, string> = {
  SUM: '+',
  MIN: '<',
  MAX: '>',
  COUNT: '#',
};

export const INPUT_TYPES = ['string', 'number', 'boolean', 'date', 'collection'];
export const OUTPUT_TYPES = ['string', 'number', 'boolean', 'date'];

const STRING_OPERATORS = ['==', '!=', 'IS IN', 'IS NOT IN'];
const NUMBER_OPERATORS = ['==', '!=', '<', '>', '>=', '<=', 'IS IN', 'IS NOT IN'];
const BOOLEAN_OPERATORS = ['==', '!='];
const COLLECTION_OPERATORS = ['ANY OF', 'NONE OF', 'ALL OF', 'NOT ALL OF', '==', '!='];
const ALL_OPERATORS = [
  '==',
  '!=',
  '<',
  '>',
  '>=',
  '<=',
  'ANY OF',
  'NONE OF',
  'ALL OF',
  'NOT ALL OF',
  'IS IN',
  'IS NOT IN',
];
const LIST_OPERATORS = ['ANY OF', 'NONE OF', 'ALL OF', 'NOT ALL OF', 'IS IN', 'IS NOT IN'];

/** Operators offered for an input column, by its variable type (same lists as the original). */
export function operatorsFor(type: string | null | undefined): string[] {
  switch (type) {
    case 'number':
    case 'date':
      return NUMBER_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    case 'string':
      return STRING_OPERATORS;
    case 'collection':
      return COLLECTION_OPERATORS;
    default:
      return ALL_OPERATORS;
  }
}

export const isCustomExpression = (value: string | null | undefined): boolean =>
  value != null && (value.startsWith('${') || value.startsWith('#{'));

export const isDash = (value: string | null | undefined): boolean => value === '-';

/** Operators whose value is a list; they stay active even for `-` or `${...}` values. */
export const isListOperator = (operator: string | null | undefined): boolean =>
  !!operator && LIST_OPERATORS.includes(operator);

/** The operator cell is unused when the condition is "any" (`-`) or a custom expression. */
export const operatorDisabled = (
  operator: string | null | undefined,
  value: string | null | undefined,
) => !isListOperator(operator) && (isDash(value) || isCustomExpression(value));

/** "F", "U", ... or "C+" for COLLECT with SUM, as in the original header cell. */
export function hitPolicyBadge(definition: DecisionTableDefinition): string {
  const policy = definition.hitIndicator || 'FIRST';
  const symbol = definition.collectOperator
    ? (COLLECT_OPERATORS[definition.collectOperator] ?? '')
    : '';
  return policy.substring(0, 1) + symbol;
}

export const operatorKey = (input: DecisionTableExpression) => `${input.id}_operator`;
export const expressionKey = (input: DecisionTableExpression) => `${input.id}_expression`;

/** Column ids are numeric strings; new ones continue after the highest id in use. */
export function nextColumnId(definition: DecisionTableDefinition): string {
  const ids = [...(definition.inputExpressions ?? []), ...(definition.outputExpressions ?? [])]
    .map((e) => parseInt(e.id, 10))
    .filter((n) => !Number.isNaN(n));
  return String(Math.max(0, ...ids) + 1);
}

export function newExpression(
  definition: DecisionTableDefinition,
  values: Partial<DecisionTableExpression> = {},
): DecisionTableExpression {
  return {
    id: nextColumnId(definition),
    label: values.label ?? null,
    variableId: values.variableId ?? null,
    type: values.type ?? null,
    newVariable: values.newVariable ?? null,
    entries: values.entries ?? null,
  };
}

export function defaultRule(definition: DecisionTableDefinition): DecisionTableRule {
  const rule: DecisionTableRule = {};
  for (const input of definition.inputExpressions ?? []) {
    rule[operatorKey(input)] = '==';
    rule[expressionKey(input)] = '-';
  }
  for (const output of definition.outputExpressions ?? []) rule[output.id] = '';
  return rule;
}

/**
 * Makes a loaded definition editable the way the original editor did: a default hit policy, at
 * least one input and output column, at least one rule, and an operator in every input cell.
 */
export function normalizeDefinition(source: DecisionTableDefinition): DecisionTableDefinition {
  const definition: DecisionTableDefinition = structuredClone(source ?? {});
  definition.hitIndicator ||= HIT_POLICIES[0];
  if (!definition.inputExpressions?.length)
    definition.inputExpressions = [newExpression(definition)];
  if (!definition.outputExpressions?.length)
    definition.outputExpressions = [newExpression(definition)];
  if (!definition.rules?.length) definition.rules = [defaultRule(definition)];
  for (const rule of definition.rules) {
    for (const input of definition.inputExpressions) {
      const key = operatorKey(input);
      if (!(key in rule) || rule[key] === '') rule[key] = '==';
    }
  }
  return definition;
}

/** Keeps only the cells that belong to a column, and fills missing ones, before saving. */
export function cleanRules(definition: DecisionTableDefinition): DecisionTableRule[] {
  const inputs = definition.inputExpressions ?? [];
  const outputs = definition.outputExpressions ?? [];
  return (definition.rules ?? []).map((rule) => {
    const clean: DecisionTableRule = {};
    for (const input of inputs) {
      clean[operatorKey(input)] = rule[operatorKey(input)] ?? '==';
      clean[expressionKey(input)] = rule[expressionKey(input)] ?? '-';
    }
    for (const output of outputs) clean[output.id] = rule[output.id] ?? '';
    return clean;
  });
}

/** Problems that would make the table fail at runtime; shown before saving, not blocking. */
export function validateDefinition(definition: DecisionTableDefinition): string[] {
  const problems: string[] = [];
  const all = [...(definition.inputExpressions ?? []), ...(definition.outputExpressions ?? [])];
  if (all.some((e) => !e.variableId)) problems.push('missing-variable');
  return problems;
}
