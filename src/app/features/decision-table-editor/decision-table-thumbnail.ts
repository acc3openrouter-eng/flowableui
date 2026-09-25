import { DecisionTableDefinition } from '../../core/api/api.types';
import { expressionKey, hitPolicyBadge, operatorKey } from './decision-table-model';

const WIDTH = 300;
const ROW = 18;
const HEADER = 30;

/**
 * Draws a small PNG sketch of the table for the library card (the original used html2canvas on
 * the grid; the server requires an image on every save).
 */
export function renderDecisionTableThumbnail(definition: DecisionTableDefinition): string {
  const inputs = definition.inputExpressions ?? [];
  const outputs = definition.outputExpressions ?? [];
  const rules = (definition.rules ?? []).slice(0, 12);
  const columns = inputs.length + outputs.length;
  const height = Math.max(90, HEADER + rules.length * ROW + 12);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const x0 = 6;
  const indexWidth = 22;
  const colWidth = (WIDTH - x0 * 2 - indexWidth) / Math.max(1, columns);
  const top = 6;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);

  // Header backgrounds: inputs blue-ish, outputs green-ish.
  ctx.fillStyle = '#e8f1fa';
  ctx.fillRect(x0 + indexWidth, top, colWidth * inputs.length, HEADER - top);
  ctx.fillStyle = '#e9f6ee';
  ctx.fillRect(
    x0 + indexWidth + colWidth * inputs.length,
    top,
    colWidth * outputs.length,
    HEADER - top,
  );
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x0, top, indexWidth, HEADER - top);

  ctx.textBaseline = 'middle';
  ctx.font = '600 10px sans-serif';
  ctx.fillStyle = '#2479bd';
  ctx.fillText(hitPolicyBadge(definition), x0 + 5, top + (HEADER - top) / 2, indexWidth - 6);

  const headers = [...inputs, ...outputs];
  ctx.fillStyle = '#334155';
  headers.forEach((column, i) => {
    const x = x0 + indexWidth + i * colWidth;
    ctx.fillText(
      column.label || column.variableId || '',
      x + 4,
      top + (HEADER - top) / 2,
      colWidth - 8,
    );
  });

  ctx.font = '9px sans-serif';
  rules.forEach((rule, r) => {
    const y = HEADER + r * ROW;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(String(r + 1), x0 + 5, y + ROW / 2, indexWidth - 6);
    ctx.fillStyle = '#334155';
    inputs.forEach((input, i) => {
      const op = rule[operatorKey(input)];
      const value = rule[expressionKey(input)] ?? '';
      const text = value === '-' || !op ? value : `${op} ${value}`;
      ctx.fillText(text, x0 + indexWidth + i * colWidth + 4, y + ROW / 2, colWidth - 8);
    });
    outputs.forEach((output, i) => {
      const x = x0 + indexWidth + (inputs.length + i) * colWidth;
      ctx.fillText(rule[output.id] ?? '', x + 4, y + ROW / 2, colWidth - 8);
    });
  });

  // Grid lines.
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  const bottom = HEADER + rules.length * ROW;
  ctx.strokeRect(x0 + 0.5, top + 0.5, WIDTH - x0 * 2, bottom - top);
  for (let r = 0; r <= rules.length; r++) {
    const y = HEADER + r * ROW + 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(WIDTH - x0, y);
    ctx.stroke();
  }
  for (let c = 0; c <= columns; c++) {
    const x = Math.round(x0 + indexWidth + c * colWidth) + 0.5;
    ctx.strokeStyle = c === inputs.length ? '#64748b' : '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}
