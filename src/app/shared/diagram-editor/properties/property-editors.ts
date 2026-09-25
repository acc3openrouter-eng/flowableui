/** How the property panel edits each property, and how it summarises complex values. */

export type Row = Record<string, unknown>;

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'multiselect';
  options?: { value: string; label: string }[];
  /** Only shown when this returns true for the row. */
  showIf?: (row: Row) => boolean;
  /** Disabled when this returns true (e.g. two checkboxes that exclude each other). */
  disabledIf?: (row: Row) => boolean;
}

export interface ListDef {
  /** Key the rows are stored under (`{fields: [...]}`), or null for a bare array. */
  wrapper: string | null;
  /** Columns of the row list. */
  columns: { key: string; label: string }[];
  fields: FieldDef[];
  newRow: (rows: Row[]) => Row;
  /** A nested list edited inside each row (listener fields, enum values...). */
  nested?: { key: string; title: string; def: ListDef; showIf?: (row: Row) => boolean };
  /** Adjusts a row after one of its fields changed. */
  onChange?: (row: Row, key: string) => void;
  /** Converts stored rows for editing. */
  load?: (row: Row) => Row;
  /** Converts edited rows back to the stored form. */
  clean?: (row: Row) => Row;
  emptyText: string;
}

export type PropertyEditor =
  | { kind: 'string' }
  | { kind: 'text' }
  | { kind: 'boolean' }
  | { kind: 'select'; options: { value: string; label: string }[] }
  | {
      kind: 'definition-ref';
      definitions: 'signaldefinitions' | 'messagedefinitions' | 'escalationdefinitions';
    }
  | { kind: 'rows'; def: ListDef; title: string; display: string; empty: string }
  | { kind: 'assignment' }
  | {
      kind: 'reference';
      source: 'forms' | 'decision-tables' | 'decision-services';
      title: string;
      empty: string;
    }
  | { kind: 'condition' }
  | { kind: 'flow-order' };

const opt = (...values: string[]) => values.map((v) => ({ value: v, label: v }));

const LISTENER_FIELDS: ListDef = {
  wrapper: null,
  columns: [
    { key: 'name', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.NAME' },
    { key: 'implementation', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.IMPLEMENTATION' },
  ],
  fields: [
    { key: 'name', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.NAME', type: 'text' },
    { key: 'stringValue', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.STRINGVALUE', type: 'text' },
    { key: 'expression', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.EXPRESSION', type: 'text' },
    { key: 'string', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.STRING', type: 'textarea' },
  ],
  newRow: () => ({
    name: 'fieldName',
    implementation: '',
    stringValue: '',
    expression: '',
    string: '',
  }),
  clean: (row) => ({ ...row, implementation: firstOf(row, 'stringValue', 'expression', 'string') }),
  emptyText: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.EMPTY',
};

const firstOf = (row: Row, ...keys: string[]) =>
  keys.map((k) => row[k]).find((v) => typeof v === 'string' && v.trim() !== '') ?? '';

function listeners(wrapper: string, events: string[], prefix: string): ListDef {
  return {
    wrapper,
    columns: [
      { key: 'event', label: `${prefix}.EVENT` },
      { key: 'implementation', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.IMPLEMENTATION' },
    ],
    fields: [
      { key: 'event', label: `${prefix}.EVENT`, type: 'select', options: opt(...events) },
      { key: 'className', label: `${prefix}.CLASS`, type: 'text' },
      { key: 'expression', label: `${prefix}.EXPRESSION`, type: 'text' },
      { key: 'delegateExpression', label: `${prefix}.DELEGATEEXPRESSION`, type: 'text' },
    ],
    newRow: () => ({
      event: events[0],
      implementation: '',
      className: '',
      expression: '',
      delegateExpression: '',
      fields: [],
    }),
    load: (row) => ({ ...row, fields: Array.isArray(row['fields']) ? row['fields'] : [] }),
    clean: (row) => ({
      ...row,
      implementation: firstOf(row, 'className', 'expression', 'delegateExpression'),
    }),
    nested: { key: 'fields', title: 'Fields', def: LISTENER_FIELDS },
    emptyText: `${prefix}.UNSELECTED`,
  };
}

/** Engine event types offered for process event listeners (same list as the original). */
export const ENGINE_EVENT_TYPES = [
  'ACTIVITY_CANCELLED',
  'ACTIVITY_COMPENSATE',
  'ACTIVITY_COMPLETED',
  'ACTIVITY_ERROR_RECEIVED',
  'ACTIVITY_MESSAGE_CANCELLED',
  'ACTIVITY_MESSAGE_RECEIVED',
  'ACTIVITY_MESSAGE_WAITING',
  'ACTIVITY_SIGNALED',
  'ACTIVITY_SIGNAL_WAITING',
  'ACTIVITY_STARTED',
  'CUSTOM',
  'ENGINE_CLOSED',
  'ENGINE_CREATED',
  'ENTITY_ACTIVATED',
  'ENTITY_CREATED',
  'ENTITY_DELETED',
  'ENTITY_INITIALIZED',
  'ENTITY_SUSPENDED',
  'ENTITY_UPDATED',
  'HISTORIC_ACTIVITY_INSTANCE_CREATED',
  'HISTORIC_ACTIVITY_INSTANCE_ENDED',
  'HISTORIC_PROCESS_INSTANCE_CREATED',
  'HISTORIC_PROCESS_INSTANCE_ENDED',
  'JOB_CANCELED',
  'JOB_EXECUTION_FAILURE',
  'JOB_EXECUTION_SUCCESS',
  'JOB_RESCHEDULED',
  'JOB_RETRIES_DECREMENTED',
  'MEMBERSHIP_CREATED',
  'MEMBERSHIP_DELETED',
  'MEMBERSHIPS_DELETED',
  'MULTI_INSTANCE_ACTIVITY_CANCELLED',
  'MULTI_INSTANCE_ACTIVITY_COMPLETED',
  'MULTI_INSTANCE_ACTIVITY_COMPLETED_WITH_CONDITION',
  'MULTI_INSTANCE_ACTIVITY_STARTED',
  'PROCESS_CANCELLED',
  'PROCESS_COMPLETED',
  'PROCESS_COMPLETED_WITH_TERMINATE_END_EVENT',
  'PROCESS_COMPLETED_WITH_ERROR_END_EVENT',
  'PROCESS_CREATED',
  'PROCESS_STARTED',
  'SEQUENCEFLOW_TAKEN',
  'TASK_ASSIGNED',
  'TASK_COMPLETED',
  'TASK_CREATED',
  'TIMER_FIRED',
  'TIMER_SCHEDULED',
  'UNCAUGHT_BPMN_ERROR',
  'VARIABLE_CREATED',
  'VARIABLE_DELETED',
  'VARIABLE_UPDATED',
];

const EVENT_LISTENERS: ListDef = {
  wrapper: 'eventListeners',
  columns: [
    { key: 'event', label: 'PROPERTY.EVENTLISTENERS.EVENTS' },
    { key: 'implementation', label: 'PROPERTY.EXECUTIONLISTENERS.FIELDS.IMPLEMENTATION' },
  ],
  fields: [
    {
      key: 'eventList',
      label: 'PROPERTY.EVENTLISTENERS.EVENTS',
      type: 'multiselect',
      options: opt(...ENGINE_EVENT_TYPES),
    },
    { key: 'rethrowEvent', label: 'PROPERTY.EVENTLISTENERS.RETHROW', type: 'checkbox' },
    {
      key: 'className',
      label: 'PROPERTY.EVENTLISTENERS.CLASS',
      type: 'text',
      showIf: (r) => !r['rethrowEvent'],
    },
    {
      key: 'delegateExpression',
      label: 'PROPERTY.EVENTLISTENERS.DELEGATEEXPRESSION',
      type: 'text',
      showIf: (r) => !r['rethrowEvent'],
    },
    {
      key: 'entityType',
      label: 'PROPERTY.EVENTLISTENERS.ENTITYTYPE',
      type: 'text',
      showIf: (r) => !r['rethrowEvent'],
    },
    {
      key: 'rethrowType',
      label: 'PROPERTY.EVENTLISTENERS.RETHROWTYPE',
      type: 'select',
      options: opt('error', 'message', 'signal', 'globalSignal'),
      showIf: (r) => !!r['rethrowEvent'],
    },
    {
      key: 'errorcode',
      label: 'PROPERTY.EVENTLISTENERS.ERRORCODE',
      type: 'text',
      showIf: (r) => !!r['rethrowEvent'] && r['rethrowType'] === 'error',
    },
    {
      key: 'messagename',
      label: 'PROPERTY.EVENTLISTENERS.MESSAGENAME',
      type: 'text',
      showIf: (r) => !!r['rethrowEvent'] && r['rethrowType'] === 'message',
    },
    {
      key: 'signalname',
      label: 'PROPERTY.EVENTLISTENERS.SIGNALNAME',
      type: 'text',
      showIf: (r) =>
        !!r['rethrowEvent'] &&
        (r['rethrowType'] === 'signal' || r['rethrowType'] === 'globalSignal'),
    },
  ],
  newRow: () => ({
    event: '',
    implementation: '',
    className: '',
    delegateExpression: '',
    rethrowEvent: false,
    eventList: [],
  }),
  load: (row) => {
    const events = Array.isArray(row['events'])
      ? (row['events'] as Row[]).map((e) => String(e['event'] ?? '')).filter(Boolean)
      : String(row['event'] ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
    return { ...row, eventList: events };
  },
  clean: (row) => {
    const out: Row = { ...row };
    const list = (out['eventList'] as string[]) ?? [];
    delete out['eventList'];
    out['events'] = list.map((event) => ({ event }));
    out['event'] = list.join(', ');
    if (out['rethrowEvent']) {
      const type = String(out['rethrowType'] ?? '');
      const target =
        type === 'error'
          ? out['errorcode']
          : type === 'message'
            ? out['messagename']
            : out['signalname'];
      out['implementation'] = `Rethrow as ${type} ${target ?? ''}`.trim();
    } else {
      out['implementation'] = firstOf(out, 'className', 'delegateExpression');
    }
    return out;
  },
  emptyText: 'PROPERTY.EVENTLISTENERS.UNSELECTED',
};

const PARAMETERS = (wrapper: string): ListDef => ({
  wrapper,
  columns: [
    { key: 'source', label: 'PROPERTY.PARAMETER.SOURCE' },
    { key: 'sourceExpression', label: 'PROPERTY.PARAMETER.SOURCEEXPRESSION' },
    { key: 'target', label: 'PROPERTY.PARAMETER.TARGET' },
  ],
  fields: [
    { key: 'source', label: 'PROPERTY.PARAMETER.SOURCE', type: 'text' },
    { key: 'sourceExpression', label: 'PROPERTY.PARAMETER.SOURCEEXPRESSION', type: 'text' },
    { key: 'target', label: 'PROPERTY.PARAMETER.TARGET', type: 'text' },
    { key: 'targetExpression', label: 'PROPERTY.PARAMETER.TARGETEXPRESSION', type: 'text' },
  ],
  newRow: () => ({ source: '', sourceExpression: '', target: '', targetExpression: '' }),
  emptyText: 'PROPERTY.PARAMETER.EMPTY',
});

const EVENT_TYPES = opt('string', 'integer', 'double', 'boolean');

const DEFINITIONS = (prefix: string, withScope: boolean): ListDef => ({
  wrapper: null,
  columns: [
    { key: 'id', label: `${prefix}.ID` },
    { key: 'name', label: `${prefix}.NAME` },
    ...(withScope ? [{ key: 'scope', label: `${prefix}.SCOPE` }] : []),
  ],
  fields: [
    { key: 'id', label: `${prefix}.ID`, type: 'text' },
    { key: 'name', label: `${prefix}.NAME`, type: 'text' },
    ...(withScope
      ? [
          {
            key: 'scope',
            label: `${prefix}.SCOPE`,
            type: 'select' as const,
            options: [
              { value: 'global', label: 'PROPERTY.SIGNALDEFINITIONS.SCOPE-GLOBAL' },
              {
                value: 'processInstance',
                label: 'PROPERTY.SIGNALDEFINITIONS.SCOPE-PROCESSINSTANCE',
              },
            ],
          },
        ]
      : []),
  ],
  newRow: () => (withScope ? { id: '', name: '', scope: 'global' } : { id: '', name: '' }),
  emptyText: `${prefix}.EMPTY`,
});

const nextId = (rows: Row[], key: string, base: string) => {
  let n = rows.length + 1;
  while (rows.some((r) => r[key] === `${base}${n}`)) n++;
  return `${base}${n}`;
};

const FORM_PROPERTIES: ListDef = {
  wrapper: 'formProperties',
  columns: [
    { key: 'id', label: 'PROPERTY.FORMPROPERTIES.ID' },
    { key: 'name', label: 'PROPERTY.FORMPROPERTIES.NAME' },
    { key: 'type', label: 'PROPERTY.FORMPROPERTIES.TYPE' },
  ],
  fields: [
    { key: 'id', label: 'PROPERTY.FORMPROPERTIES.ID', type: 'text' },
    { key: 'name', label: 'PROPERTY.FORMPROPERTIES.NAME', type: 'text' },
    {
      key: 'type',
      label: 'PROPERTY.FORMPROPERTIES.TYPE',
      type: 'select',
      options: opt('string', 'long', 'boolean', 'date', 'enum'),
    },
    {
      key: 'datePattern',
      label: 'PROPERTY.FORMPROPERTIES.DATEPATTERN',
      type: 'text',
      showIf: (r) => r['type'] === 'date',
    },
    { key: 'expression', label: 'PROPERTY.FORMPROPERTIES.EXPRESSION', type: 'text' },
    { key: 'variable', label: 'PROPERTY.FORMPROPERTIES.VARIABLE', type: 'text' },
    { key: 'default', label: 'PROPERTY.FORMPROPERTIES.DEFAULT', type: 'text' },
    { key: 'required', label: 'PROPERTY.FORMPROPERTIES.REQUIRED', type: 'checkbox' },
    { key: 'readable', label: 'PROPERTY.FORMPROPERTIES.READABLE', type: 'checkbox' },
    { key: 'writable', label: 'PROPERTY.FORMPROPERTIES.WRITABLE', type: 'checkbox' },
  ],
  newRow: (rows) => ({
    id: nextId(rows, 'id', 'new_property_'),
    name: '',
    type: 'string',
    readable: true,
    writable: true,
  }),
  onChange: (row, key) => {
    if (key !== 'type') return;
    if (row['type'] === 'date' && !row['datePattern']) row['datePattern'] = 'MM-dd-yyyy hh:mm';
    if (row['type'] === 'enum' && !Array.isArray(row['enumValues'])) {
      row['enumValues'] = [
        { id: 'value1', name: 'Value 1' },
        { id: 'value2', name: 'Value 2' },
      ];
    }
  },
  load: (row) => ({
    ...row,
    enumValues: Array.isArray(row['enumValues'])
      ? (row['enumValues'] as Row[]).map((v) =>
          v['id'] == null && v['value'] != null ? { id: v['value'], name: v['value'] } : v,
        )
      : row['enumValues'],
  }),
  clean: (row) => {
    const out = { ...row };
    if (out['type'] !== 'date') delete out['datePattern'];
    if (out['type'] !== 'enum') delete out['enumValues'];
    return out;
  },
  nested: {
    key: 'enumValues',
    title: 'PROPERTY.FORMPROPERTIES.VALUES',
    showIf: (r) => r['type'] === 'enum',
    def: {
      wrapper: null,
      columns: [
        { key: 'id', label: 'PROPERTY.FORMPROPERTIES.VALUES.ID' },
        { key: 'name', label: 'PROPERTY.FORMPROPERTIES.VALUES.NAME' },
      ],
      fields: [
        { key: 'id', label: 'PROPERTY.FORMPROPERTIES.VALUES.ID', type: 'text' },
        { key: 'name', label: 'PROPERTY.FORMPROPERTIES.VALUES.NAME', type: 'text' },
      ],
      newRow: (rows) => ({ id: nextId(rows, 'id', 'value'), name: '' }),
      emptyText: 'PROPERTY.FORMPROPERTIES.ENUMVALUES.EMPTY',
    },
  },
  emptyText: 'PROPERTY.FORMPROPERTIES.EMPTY',
};

const VARIABLE_AGGREGATIONS: ListDef = {
  wrapper: 'aggregations',
  columns: [
    { key: 'target', label: 'PROPERTY.PARAMETER.TARGET' },
    { key: 'targetExpression', label: 'PROPERTY.PARAMETER.TARGETEXPRESSION' },
  ],
  fields: [
    { key: 'target', label: 'PROPERTY.PARAMETER.TARGET', type: 'text' },
    { key: 'targetExpression', label: 'PROPERTY.PARAMETER.TARGETEXPRESSION', type: 'text' },
    { key: 'class', label: 'PROPERTY.VARIABLE.AGGREGATIONS.CLASS', type: 'text' },
    {
      key: 'delegateExpression',
      label: 'PROPERTY.VARIABLE.AGGREGATIONS.DELEGATEEXPRESSION',
      type: 'text',
    },
    {
      key: 'createOverview',
      label: 'PROPERTY.VARIABLE.AGGREGATIONS.CREATEOVERVIEW',
      type: 'checkbox',
      disabledIf: (r) => !!r['storeAsTransient'],
    },
    {
      key: 'storeAsTransient',
      label: 'PROPERTY.VARIABLE.AGGREGATIONS.STOREASTRANSIENT',
      type: 'checkbox',
      disabledIf: (r) => !!r['createOverview'],
    },
  ],
  newRow: () => ({ target: '', targetExpression: '', definitions: [] }),
  load: (row) => ({
    ...row,
    definitions: Array.isArray(row['definitions']) ? row['definitions'] : [],
  }),
  nested: { key: 'definitions', title: 'PROPERTY.PARAMETER.SOURCE', def: PARAMETERS('') },
  emptyText: 'PROPERTY.VARIABLE.AGGREGATIONS.UNSELECTED',
};

const rows = (def: ListDef, title: string, display: string, empty: string): PropertyEditor => ({
  kind: 'rows',
  def,
  title,
  display,
  empty,
});

/** Editors for Complex and multiplecomplex properties, by JSON key. */
const COMPLEX: Record<string, PropertyEditor> = {
  usertaskassignment: { kind: 'assignment' },
  formproperties: rows(
    FORM_PROPERTIES,
    'PROPERTY.FORMPROPERTIES.ID',
    'PROPERTY.FORMPROPERTIES.VALUE',
    'PROPERTY.FORMPROPERTIES.EMPTY',
  ),
  executionlisteners: rows(
    listeners('executionListeners', ['start', 'end', 'take'], 'PROPERTY.EXECUTIONLISTENERS'),
    '',
    'PROPERTY.EXECUTIONLISTENERS.DISPLAY',
    'PROPERTY.EXECUTIONLISTENERS.EMPTY',
  ),
  tasklisteners: rows(
    listeners(
      'taskListeners',
      ['create', 'assignment', 'complete', 'delete'],
      'PROPERTY.TASKLISTENERS',
    ),
    '',
    'PROPERTY.TASKLISTENERS.VALUE',
    'PROPERTY.TASKLISTENERS.EMPTY',
  ),
  eventlisteners: rows(
    EVENT_LISTENERS,
    '',
    'PROPERTY.EVENTLISTENERS.DISPLAY',
    'PROPERTY.EVENTLISTENERS.EMPTY',
  ),
  servicetaskfields: rows(
    { ...LISTENER_FIELDS, wrapper: 'fields', emptyText: 'PROPERTY.FIELDS.EMPTY' },
    '',
    'PROPERTY.FIELDS',
    'PROPERTY.FIELDS.EMPTY',
  ),
  servicetaskexceptions: rows(
    {
      wrapper: 'exceptions',
      columns: [
        { key: 'code', label: 'PROPERTY.EXCEPTIONS.CODE' },
        { key: 'class', label: 'PROPERTY.EXCEPTIONS.CLASS' },
      ],
      fields: [
        { key: 'code', label: 'PROPERTY.EXCEPTIONS.CODE', type: 'text' },
        { key: 'class', label: 'PROPERTY.EXCEPTIONS.CLASS', type: 'text' },
        { key: 'children', label: 'PROPERTY.EXCEPTIONS.CHILDREN', type: 'checkbox' },
      ],
      newRow: () => ({ code: '', class: '', children: false }),
      emptyText: 'PROPERTY.EXCEPTIONS.EMPTY',
    },
    '',
    'PROPERTY.EXCEPTIONS',
    'PROPERTY.EXCEPTIONS.EMPTY',
  ),
  callactivityinparameters: rows(
    PARAMETERS('inParameters'),
    '',
    'PROPERTY.INPARAMETERS.VALUE',
    'PROPERTY.INPARAMETERS.EMPTY',
  ),
  callactivityoutparameters: rows(
    PARAMETERS('outParameters'),
    '',
    'PROPERTY.OUTPARAMETERS.VALUE',
    'PROPERTY.OUTPARAMETERS.EMPTY',
  ),
  eventinparameters: rows(
    {
      wrapper: 'inParameters',
      columns: [
        { key: 'variableName', label: 'PROPERTY.EVENTINPARAMETERS.VARIABLENAME' },
        { key: 'eventName', label: 'PROPERTY.EVENTINPARAMETERS.EVENTNAME' },
        { key: 'eventType', label: 'PROPERTY.EVENTINPARAMETERS.EVENTTYPE' },
      ],
      fields: [
        { key: 'variableName', label: 'PROPERTY.EVENTINPARAMETERS.VARIABLENAME', type: 'text' },
        { key: 'eventName', label: 'PROPERTY.EVENTINPARAMETERS.EVENTNAME', type: 'text' },
        {
          key: 'eventType',
          label: 'PROPERTY.EVENTINPARAMETERS.EVENTTYPE',
          type: 'select',
          options: EVENT_TYPES,
        },
      ],
      newRow: () => ({ variableName: '', eventName: '', eventType: 'string' }),
      emptyText: 'PROPERTY.EVENTINPARAMETERS.NOSELECTION',
    },
    '',
    'PROPERTY.EVENTINPARAMETERS.VALUE',
    'PROPERTY.EVENTINPARAMETERS.EMPTY',
  ),
  eventoutparameters: rows(
    {
      wrapper: 'outParameters',
      columns: [
        { key: 'eventName', label: 'PROPERTY.EVENTOUTPARAMETERS.EVENTNAME' },
        { key: 'eventType', label: 'PROPERTY.EVENTOUTPARAMETERS.EVENTTYPE' },
        { key: 'variableName', label: 'PROPERTY.EVENTOUTPARAMETERS.VARIABLENAME' },
      ],
      fields: [
        { key: 'eventName', label: 'PROPERTY.EVENTOUTPARAMETERS.EVENTNAME', type: 'text' },
        {
          key: 'eventType',
          label: 'PROPERTY.EVENTOUTPARAMETERS.EVENTTYPE',
          type: 'select',
          options: EVENT_TYPES,
        },
        { key: 'variableName', label: 'PROPERTY.EVENTOUTPARAMETERS.VARIABLENAME', type: 'text' },
      ],
      newRow: () => ({ eventName: '', eventType: 'string', variableName: '' }),
      emptyText: 'PROPERTY.EVENTOUTPARAMETERS.NOSELECTION',
    },
    '',
    'PROPERTY.EVENTOUTPARAMETERS.VALUE',
    'PROPERTY.EVENTOUTPARAMETERS.EMPTY',
  ),
  eventcorrelationparameters: rows(
    {
      wrapper: 'correlationParameters',
      columns: [
        { key: 'name', label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.NAME' },
        { key: 'type', label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.TYPE' },
        { key: 'value', label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.VALUEPROP' },
      ],
      fields: [
        { key: 'name', label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.NAME', type: 'text' },
        {
          key: 'type',
          label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.TYPE',
          type: 'select',
          options: EVENT_TYPES,
        },
        { key: 'value', label: 'PROPERTY.EVENTCORRELATIONPARAMETERS.VALUEPROP', type: 'text' },
      ],
      newRow: () => ({ name: '', type: 'string', value: '' }),
      emptyText: 'PROPERTY.EVENTCORRELATIONPARAMETERS.NOSELECTION',
    },
    '',
    'PROPERTY.EVENTCORRELATIONPARAMETERS.VALUE',
    'PROPERTY.EVENTCORRELATIONPARAMETERS.EMPTY',
  ),
  dataproperties: rows(
    {
      wrapper: 'items',
      columns: [
        { key: 'dataproperty_id', label: 'PROPERTY.DATAPROPERTIES.ID' },
        { key: 'dataproperty_name', label: 'PROPERTY.DATAPROPERTIES.NAME' },
        { key: 'dataproperty_type', label: 'PROPERTY.DATAPROPERTIES.TYPE' },
        { key: 'dataproperty_value', label: 'PROPERTY.DATAPROPERTIES.VALUE' },
      ],
      fields: [
        { key: 'dataproperty_id', label: 'PROPERTY.DATAPROPERTIES.ID', type: 'text' },
        { key: 'dataproperty_name', label: 'PROPERTY.DATAPROPERTIES.NAME', type: 'text' },
        {
          key: 'dataproperty_type',
          label: 'PROPERTY.DATAPROPERTIES.TYPE',
          type: 'select',
          options: opt('string', 'boolean', 'datetime', 'double', 'int', 'long'),
        },
        { key: 'dataproperty_value', label: 'PROPERTY.DATAPROPERTIES.VALUE', type: 'text' },
      ],
      newRow: (rows) => ({
        dataproperty_id: nextId(rows, 'dataproperty_id', 'new_data_object_'),
        dataproperty_name: '',
        dataproperty_type: 'string',
      }),
      emptyText: 'PROPERTY.DATAPROPERTIES.EMPTY',
    },
    '',
    'PROPERTY.DATAPROPERTIES.VALUES',
    'PROPERTY.DATAPROPERTIES.EMPTY',
  ),
  signaldefinitions: rows(
    DEFINITIONS('PROPERTY.SIGNALDEFINITIONS', true),
    '',
    'PROPERTY.SIGNALDEFINITIONS.DISPLAY',
    'PROPERTY.SIGNALDEFINITIONS.EMPTY',
  ),
  messagedefinitions: rows(
    DEFINITIONS('PROPERTY.MESSAGEDEFINITIONS', false),
    '',
    'PROPERTY.MESSAGEDEFINITIONS.DISPLAY',
    'PROPERTY.MESSAGEDEFINITIONS.EMPTY',
  ),
  escalationdefinitions: rows(
    DEFINITIONS('PROPERTY.ESCALATIONDEFINITIONS', false),
    '',
    'PROPERTY.ESCALATIONDEFINITIONS.DISPLAY',
    'PROPERTY.ESCALATIONDEFINITIONS.EMPTY',
  ),
  multiinstance_variableaggregations: rows(
    VARIABLE_AGGREGATIONS,
    '',
    'PROPERTY.VARIABLE.AGGREGATIONS.VALUE',
    'PROPERTY.VARIABLE.AGGREGATIONS.EMPTY',
  ),
  formreference: {
    kind: 'reference',
    source: 'forms',
    title: 'PROPERTY.FORMREFERENCE.TITLE',
    empty: 'PROPERTY.FORMREFERENCE.EMPTY',
  },
  decisiontaskdecisiontablereference: {
    kind: 'reference',
    source: 'decision-tables',
    title: 'PROPERTY.DECISIONTABLEREFERENCE.TITLE',
    empty: 'PROPERTY.DECISIONTABLEREFERENCE.EMPTY',
  },
  decisiontaskdecisionservicereference: {
    kind: 'reference',
    source: 'decision-services',
    title: 'PROPERTY.DECISIONSERVICEREFERENCE.TITLE',
    empty: 'PROPERTY.DECISIONSERVICEREFERENCE.EMPTY',
  },
  conditionsequenceflow: { kind: 'condition' },
  sequencefloworder: { kind: 'flow-order' },
};

const SELECTS: Record<string, { value: string; label: string }[]> = {
  'flowable-multiinstance': opt('None', 'Parallel', 'Sequential'),
  'flowable-ordering': opt('Parallel', 'Sequential'),
  'flowable-http-request-method': opt('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
  'flowable-processhistorylevel': [
    { value: '', label: '' },
    ...opt('none', 'activity', 'audit', 'full'),
  ],
  'flowable-channeltype': [{ value: '', label: '' }, ...opt('jms', 'kafka', 'rabbitmq')],
  'flowable-calledelementtype': opt('key', 'id'),
  'flowable-variablechangetype': [
    { value: 'all', label: 'All' },
    { value: 'create', label: 'Create only' },
    { value: 'update', label: 'Update only' },
    { value: 'createupdate', label: 'Create and update' },
  ],
};

const DEFINITION_REFS: Record<
  string,
  'signaldefinitions' | 'messagedefinitions' | 'escalationdefinitions'
> = {
  signalref: 'signaldefinitions',
  messageref: 'messagedefinitions',
  escalationref: 'escalationdefinitions',
};

/** The editor for a property, or null when the original editor would not show it. */
export function editorFor(key: string, type: string): PropertyEditor | null {
  if (type === 'complex' || type === 'multiplecomplex') return COMPLEX[key] ?? null;
  if (SELECTS[type]) return { kind: 'select', options: SELECTS[type] };
  if (type === 'string' && DEFINITION_REFS[key]) {
    return { kind: 'definition-ref', definitions: DEFINITION_REFS[key] };
  }
  if (type === 'string') return { kind: 'string' };
  if (type === 'text') return { kind: 'text' };
  if (type === 'boolean') return { kind: 'boolean' };
  return null;
}

/** Parses a complex value that may be stored as a JSON string. */
export function complexValue(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? complexValue(parsed) : parsed;
  } catch {
    return value;
  }
}

/** Rows of a list property, whatever form it is stored in. */
export function listRows(def: ListDef, value: unknown): Row[] {
  const v = complexValue(value);
  const list = def.wrapper ? (v as Row | null)?.[def.wrapper] : v;
  const parsed = complexValue(list);
  return Array.isArray(parsed) ? (parsed as Row[]) : [];
}

/** Stored value of a list property: `{wrapper: rows}`, a bare array, or null when empty. */
export function listValue(def: ListDef, rows: Row[]): unknown {
  if (!rows.length) return null;
  return def.wrapper ? { [def.wrapper]: rows } : rows;
}

export interface Summary {
  key: string;
  params?: Record<string, unknown>;
  text?: string;
  empty?: boolean;
}

const truncate = (s: string) => (s.length > 20 ? `${s.substring(0, 20)}...` : s);

/** One-line text for a collapsed property row (the original's read templates). */
export function summarize(editor: PropertyEditor, value: unknown): Summary {
  switch (editor.kind) {
    case 'rows': {
      const n = listRows(editor.def, value).length;
      return n
        ? { key: editor.display, params: { length: n } }
        : { key: editor.empty, empty: true };
    }
    case 'assignment':
      return assignmentSummary(complexValue(value) as Row | null);
    case 'reference': {
      const v = complexValue(value) as Row | null;
      const name = v && typeof v === 'object' ? (v['name'] as string) : '';
      return name ? { key: '', text: name } : { key: editor.empty, empty: true };
    }
    case 'condition': {
      const v = complexValue(value);
      const text =
        typeof v === 'string'
          ? v
          : String(((v as Row | null)?.['expression'] as Row | undefined)?.['staticValue'] ?? '');
      return text
        ? { key: '', text: truncate(text) }
        : { key: 'PROPERTY.SEQUENCEFLOW.CONDITION.NO-CONDITION-DISPLAY', empty: true };
    }
    case 'flow-order': {
      const v = complexValue(value) as Row | null;
      const order = v?.['sequenceFlowOrder'];
      return Array.isArray(order) && order.length
        ? { key: 'PROPERTY.SEQUENCEFLOW.ORDER.NOT.EMPTY' }
        : { key: 'PROPERTY.SEQUENCEFLOW.ORDER.EMPTY', empty: true };
    }
    default:
      return value === '' || value == null
        ? { key: 'PROPERTY.EMPTY', empty: true }
        : { key: '', text: String(value) };
  }
}

function assignmentSummary(value: Row | null): Summary {
  const a = value?.['assignment'] as Row | undefined;
  if (!a) return { key: 'PROPERTY.ASSIGNMENT.EMPTY', empty: true };
  if (a['type'] === 'idm') {
    const idm = a['idm'] as Row | undefined;
    const assignee = idm?.['assignee'] as Row | undefined;
    if (idm?.['type'] === 'user' && assignee) {
      return assignee['id']
        ? {
            key: 'PROPERTY.ASSIGNMENT.USER_IDM_DISPLAY',
            params: {
              firstName: assignee['firstName'] ?? assignee['id'],
              lastName: assignee['lastName'] ?? '',
            },
          }
        : {
            key: 'PROPERTY.ASSIGNMENT.USER_IDM_EMAIL_DISPLAY',
            params: { email: assignee['email'] },
          };
    }
    const users = idm?.['candidateUsers'] as unknown[] | undefined;
    if (idm?.['type'] === 'users' && users?.length) {
      return {
        key: 'PROPERTY.ASSIGNMENT.CANDIDATE_USERS_DISPLAY',
        params: { length: users.length },
      };
    }
    const groups = idm?.['candidateGroups'] as unknown[] | undefined;
    if (idm?.['type'] === 'groups' && groups?.length) {
      return {
        key: 'PROPERTY.ASSIGNMENT.CANDIDATE_GROUPS_DISPLAY',
        params: { length: groups.length },
      };
    }
    return { key: 'PROPERTY.ASSIGNMENT.IDM_EMPTY' };
  }
  if (a['assignee'])
    return { key: 'PROPERTY.ASSIGNMENT.ASSIGNEE_DISPLAY', params: { assignee: a['assignee'] } };
  const users = a['candidateUsers'] as unknown[] | undefined;
  if (users?.length)
    return { key: 'PROPERTY.ASSIGNMENT.CANDIDATE_USERS_DISPLAY', params: { length: users.length } };
  const groups = a['candidateGroups'] as unknown[] | undefined;
  if (groups?.length) {
    return {
      key: 'PROPERTY.ASSIGNMENT.CANDIDATE_GROUPS_DISPLAY',
      params: { length: groups.length },
    };
  }
  return { key: 'PROPERTY.ASSIGNMENT.EMPTY', empty: true };
}
