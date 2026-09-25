import { FormField } from '../../core/api/api.types';

/** A field on the editor canvas. `_guid` is editor-only and stripped before saving. */
export interface EditorField extends FormField {
  _guid: string;
  fieldType?: string;
  overrideId?: boolean;
  value?: unknown;
  hasEmptyValue?: boolean;
  optionType?: string;
  optionsExpression?: string | null;
  expression?: string;
  [key: string]: unknown;
}

export interface PaletteItem {
  type: string;
  i18n: string;
  icon: string;
}

/** Same order and field types as the original form builder palette. */
export const PALETTE: PaletteItem[] = [
  { type: 'text', i18n: 'TEXT', icon: 'pi pi-pencil' },
  { type: 'password', i18n: 'PASSWORD', icon: 'pi pi-lock' },
  { type: 'multi-line-text', i18n: 'MULTILINE-TEXT', icon: 'pi pi-align-left' },
  { type: 'integer', i18n: 'NUMBER', icon: 'pi pi-hashtag' },
  { type: 'decimal', i18n: 'DECIMAL', icon: 'pi pi-percentage' },
  { type: 'boolean', i18n: 'CHECKBOX', icon: 'pi pi-check-square' },
  { type: 'date', i18n: 'DATE', icon: 'pi pi-calendar' },
  { type: 'dropdown', i18n: 'DROPDOWN', icon: 'pi pi-chevron-circle-down' },
  { type: 'radio-buttons', i18n: 'RADIO', icon: 'pi pi-circle-on' },
  { type: 'people', i18n: 'PEOPLE', icon: 'pi pi-user' },
  { type: 'functional-group', i18n: 'GROUP-OF-PEOPLE', icon: 'pi pi-users' },
  { type: 'upload', i18n: 'UPLOAD', icon: 'pi pi-upload' },
  { type: 'expression', i18n: 'EXPRESSION', icon: 'pi pi-code' },
  { type: 'hyperlink', i18n: 'HYPERLINK', icon: 'pi pi-link' },
  { type: 'spacer', i18n: 'SPACER', icon: 'pi pi-arrows-v' },
  { type: 'horizontal-line', i18n: 'HORIZONTAL-LINE', icon: 'pi pi-minus' },
  { type: 'headline', i18n: 'HEADLINE', icon: 'pi pi-bars' },
  { type: 'headline-with-line', i18n: 'HEADLINE-WITH-LINE', icon: 'pi pi-equals' },
];

export const paletteItem = (type: string): PaletteItem | undefined =>
  PALETTE.find((item) => item.type === type);

const NO_REQUIRED = [
  'expression',
  'hyperlink',
  'spacer',
  'horizontal-line',
  'headline',
  'headline-with-line',
];
const PLACEHOLDER = [
  'text',
  'password',
  'multi-line-text',
  'integer',
  'decimal',
  'date',
  'dropdown',
  'people',
  'functional-group',
];
const ADVANCED = ['text', 'password', 'multi-line-text', 'integer', 'decimal', 'hyperlink'];

/** Which parts of the field editor apply to a field type. */
export const fieldCapabilities = (type: string) => ({
  requiredAndReadOnly: !NO_REQUIRED.includes(type),
  placeholder: PLACEHOLDER.includes(type),
  options: type === 'dropdown' || type === 'radio-buttons',
  upload: type === 'upload',
  advanced: ADVANCED.includes(type),
  lengths: ['text', 'password', 'multi-line-text', 'integer', 'decimal'].includes(type),
  patternAndMask: ['text', 'multi-line-text', 'integer', 'decimal'].includes(type),
  passwordUnmask: type === 'password',
  expression: type === 'expression',
  hyperlink: type === 'hyperlink',
});

let guidCounter = 0;
export const newGuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `fm-${Date.now().toString(36)}-${(guidCounter++).toString(36)}`;

/** Creates a new field like the original palette did. `t` translates the default option labels. */
export function newField(type: string, t: (key: string) => string): EditorField {
  const field: EditorField = {
    _guid: newGuid(),
    type,
    id: '',
    name: 'Label',
    required: false,
    readOnly: false,
    overrideId: false,
  };
  if (type === 'radio-buttons') {
    field.fieldType = 'OptionFormField';
    field.options = [{ name: t('FORM-BUILDER.COMPONENT.RADIO-BUTTON-DEFAULT') }];
  } else if (type === 'dropdown') {
    const empty = t('FORM-BUILDER.COMPONENT.DROPDOWN-DEFAULT-EMPTY-SELECTION');
    field.fieldType = 'OptionFormField';
    field.options = [{ name: empty }];
    field.value = empty;
    field.hasEmptyValue = true;
  } else if (type === 'expression') {
    field.fieldType = 'ExpressionFormField';
  }
  return field;
}

/** The id the original builder derives from the label when "override id" is off. */
export function deriveFieldId(name: string | undefined, index: number): string {
  if (!name) return `field${index}`;
  return name
    .toLowerCase()
    .replace(/ /g, '')
    .replace(/[&/\\#,+~%.'":*?!<>{}()$@;]/g, '');
}

/** Adds editor guids to fields loaded from the server. */
export function toEditorFields(fields: FormField[] | undefined): EditorField[] {
  return (fields ?? []).map((field) => ({
    ...structuredClone(field),
    _guid: newGuid(),
  })) as EditorField[];
}

/** Recursively removes editor-only properties (every key starting with `_`). */
export function stripPrivate<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripPrivate(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (!key.startsWith('_')) out[key] = stripPrivate(v);
    }
    return out as T;
  }
  return value;
}

/** Fields as the server expects them: ids derived where not overridden, private keys removed. */
export function toSavedFields(fields: EditorField[]): FormField[] {
  return fields.map((field, index) => {
    const copy = stripPrivate(field);
    if (!copy.overrideId) copy.id = deriveFieldId(copy.name, index);
    return copy;
  });
}
