import { FormField } from '../../core/api/api.types';

const WIDTH = 300;
const PAD = 14;
const INNER = WIDTH - PAD * 2;

/**
 * Draws a small PNG sketch of the form for the library card. The original used html2canvas on the
 * canvas section; a direct 2D drawing gives the same kind of thumbnail without the dependency.
 */
export function renderFormThumbnail(fields: FormField[], outcomes: { name: string }[]): string {
  const rows = layout(fields, outcomes);
  const height = Math.max(
    120,
    rows.reduce((h, r) => h + r.height, PAD * 2),
  );
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'top';
  let y = PAD;
  for (const row of rows) {
    row.draw(ctx, y);
    y += row.height;
  }
  return canvas.toDataURL('image/png');
}

interface Row {
  height: number;
  draw: (ctx: CanvasRenderingContext2D, y: number) => void;
}

const LABEL = '#374151';
const BORDER = '#cbd5e1';
const MUTED = '#94a3b8';
const PRIMARY = '#2479bd';

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
) {
  ctx.font = font;
  ctx.fillStyle = color;
  let s = value;
  while (s.length > 1 && ctx.measureText(s).width > INNER - (x - PAD)) s = s.slice(0, -2) + '…';
  ctx.fillText(s, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w, h, 4);
  ctx.stroke();
}

function layout(fields: FormField[], outcomes: { name: string }[]): Row[] {
  const rows: Row[] = [];
  const flat: FormField[] = [];
  const walk = (list: FormField[] | undefined) => {
    for (const f of list ?? []) {
      flat.push(f);
      if (f.fields) Object.values(f.fields).forEach(walk);
    }
  };
  walk(fields);

  for (const field of flat) {
    const label = field.name || field.id || '';
    switch (field.type) {
      case 'spacer':
        rows.push({ height: 16, draw: () => undefined });
        break;
      case 'horizontal-line':
        rows.push({
          height: 14,
          draw: (ctx, y) => {
            ctx.fillStyle = BORDER;
            ctx.fillRect(PAD, y + 6, INNER, 1);
          },
        });
        break;
      case 'headline':
      case 'headline-with-line':
        rows.push({
          height: field.type === 'headline' ? 24 : 30,
          draw: (ctx, y) => {
            text(ctx, label, PAD, y + 2, '600 15px sans-serif', LABEL);
            if (field.type === 'headline-with-line') {
              ctx.fillStyle = BORDER;
              ctx.fillRect(PAD, y + 23, INNER, 1);
            }
          },
        });
        break;
      case 'boolean':
        rows.push({
          height: 24,
          draw: (ctx, y) => {
            box(ctx, PAD, y + 2, 12, 12);
            text(ctx, label, PAD + 20, y + 2, '12px sans-serif', LABEL);
          },
        });
        break;
      case 'radio-buttons': {
        const options = field.options ?? [];
        rows.push({
          height: 20 + options.length * 18 + 6,
          draw: (ctx, y) => {
            text(ctx, label, PAD, y, '600 11px sans-serif', LABEL);
            options.forEach((o, i) => {
              ctx.strokeStyle = BORDER;
              ctx.beginPath();
              ctx.arc(PAD + 6, y + 26 + i * 18, 5.5, 0, Math.PI * 2);
              ctx.stroke();
              text(ctx, o.name, PAD + 18, y + 20 + i * 18, '12px sans-serif', LABEL);
            });
          },
        });
        break;
      }
      case 'expression':
      case 'hyperlink':
        rows.push({
          height: 24,
          draw: (ctx, y) =>
            text(
              ctx,
              label,
              PAD,
              y + 2,
              '12px sans-serif',
              field.type === 'hyperlink' ? PRIMARY : LABEL,
            ),
        });
        break;
      default: {
        const tall = field.type === 'multi-line-text';
        rows.push({
          height: 18 + (tall ? 44 : 24) + 8,
          draw: (ctx, y) => {
            text(ctx, label + (field.required ? ' *' : ''), PAD, y, '600 11px sans-serif', LABEL);
            box(ctx, PAD, y + 16, INNER, tall ? 44 : 24);
            if (field.placeholder)
              text(ctx, field.placeholder, PAD + 8, y + 23, '11px sans-serif', MUTED);
          },
        });
      }
    }
  }

  const buttons = outcomes.length ? outcomes.map((o) => o.name) : ['Complete'];
  rows.push({
    height: 36,
    draw: (ctx, y) => {
      let x = WIDTH - PAD;
      ctx.font = '600 11px sans-serif';
      for (const name of [...buttons].reverse()) {
        const w = Math.min(120, ctx.measureText(name).width + 20);
        x -= w;
        if (x < PAD) break;
        ctx.fillStyle = PRIMARY;
        ctx.beginPath();
        ctx.roundRect(x, y + 8, w, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, x + 10, y + 15, w - 20);
        x -= 8;
      }
    },
  });
  return rows;
}
