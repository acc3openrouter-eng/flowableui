import {
  deriveFieldId,
  fieldCapabilities,
  newField,
  stripPrivate,
  toEditorFields,
  toSavedFields,
} from './form-field-types';

const t = (key: string) => `t:${key}`;

describe('form field types', () => {
  it('derives ids from labels like the original builder', () => {
    expect(deriveFieldId('First name', 0)).toBe('firstname');
    expect(deriveFieldId("Who's (really) #1?", 3)).toBe('whosreally1');
    expect(deriveFieldId('', 4)).toBe('field4');
  });

  it('creates option and expression fields with their defaults', () => {
    const dropdown = newField('dropdown', t);
    expect(dropdown.fieldType).toBe('OptionFormField');
    expect(dropdown.options).toEqual([
      { name: 't:FORM-BUILDER.COMPONENT.DROPDOWN-DEFAULT-EMPTY-SELECTION' },
    ]);
    expect(dropdown.value).toBe(dropdown.options?.[0].name);
    expect(dropdown.hasEmptyValue).toBe(true);
    expect(newField('radio-buttons', t).options).toHaveLength(1);
    expect(newField('expression', t).fieldType).toBe('ExpressionFormField');
    expect(newField('text', t).name).toBe('Label');
  });

  it('strips editor-only keys recursively', () => {
    expect(stripPrivate({ a: 1, _b: 2, c: [{ _d: 1, e: 2 }] })).toEqual({ a: 1, c: [{ e: 2 }] });
  });

  it('prepares fields for saving', () => {
    const fields = toEditorFields([
      { id: 'old', name: 'Full name', type: 'text' },
      { id: 'custom', name: 'X', type: 'text', overrideId: true } as never,
    ]);
    expect(fields[0]._guid).toBeTruthy();
    expect(toSavedFields(fields)).toEqual([
      { id: 'fullname', name: 'Full name', type: 'text' },
      { id: 'custom', name: 'X', type: 'text', overrideId: true },
    ]);
  });

  it('knows which editor tabs apply', () => {
    expect(fieldCapabilities('dropdown').options).toBe(true);
    expect(fieldCapabilities('upload').upload).toBe(true);
    expect(fieldCapabilities('headline').requiredAndReadOnly).toBe(false);
    expect(fieldCapabilities('boolean').placeholder).toBe(false);
    expect(fieldCapabilities('password').passwordUnmask).toBe(true);
    expect(fieldCapabilities('password').patternAndMask).toBe(false);
  });
});
