/**
 * The read-only "display JSON" the Modeler API returns from `GET /rest/models/{id}/model-json`
 * (BPMN, CMMN and DMN decision services share the shape).
 */
export interface DisplayPoint {
  x: number;
  y: number;
}

export interface DisplayElement {
  id: string;
  name?: string | null;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  taskType?: string;
  interrupting?: boolean;
  cancelActivity?: boolean;
  eventDefinition?: { type?: string };
  text?: string;
}

export interface DisplayFlow {
  id: string;
  type: string;
  name?: string | null;
  sourceRef?: string;
  targetRef?: string;
  waypoints: DisplayPoint[];
}

export interface DisplayLane {
  id: string;
  name?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayPool extends DisplayLane {
  lanes?: DisplayLane[];
}

export interface DisplayModel {
  elements?: DisplayElement[];
  flows?: DisplayFlow[];
  pools?: DisplayPool[];
  diagramBeginX?: number;
  diagramBeginY?: number;
  diagramWidth?: number;
  diagramHeight?: number;
}

export type ShapeKind =
  | 'event'
  | 'gateway'
  | 'container'
  | 'milestone'
  | 'criterion'
  | 'annotation'
  | 'decision'
  | 'task';

const CONTAINERS = new Set([
  'SubProcess',
  'EventSubProcess',
  'AdhocSubProcess',
  'Transaction',
  'Stage',
  'PlanModel',
  'DecisionService',
]);

export function shapeKind(type: string): ShapeKind {
  if (CONTAINERS.has(type)) return 'container';
  if (type.endsWith('Event') || type.endsWith('EventListener')) return 'event';
  if (type.endsWith('Gateway')) return 'gateway';
  if (type === 'Milestone') return 'milestone';
  if (type === 'EntryCriterion' || type === 'ExitCriterion') return 'criterion';
  if (type === 'TextAnnotation') return 'annotation';
  if (type === 'Decision') return 'decision';
  return 'task';
}

/** Splits a label into lines that fit roughly `maxWidth` pixels of 12px text. */
export function wrapText(text: string, maxWidth: number, maxLines = 4): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / 6.6));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/…$/, '')}…`;
    return kept;
  }
  return lines;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bounding box of everything in the model, with a margin. */
export function modelBounds(model: DisplayModel, margin = 24): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const e of model.elements ?? []) add(e.x, e.y, e.width, e.height);
  for (const p of model.pools ?? []) add(p.x, p.y, p.width, p.height);
  for (const f of model.flows ?? []) for (const w of f.waypoints ?? []) add(w.x, w.y);
  if (!isFinite(minX)) return { x: 0, y: 0, width: 400, height: 200 };
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}
