/** Model types, as defined by `org.flowable.ui.modeler.domain.AbstractModel`. */
export enum ModelType {
  Bpmn = 0,
  Form = 2,
  App = 3,
  DecisionTable = 4,
  Cmmn = 5,
  DecisionService = 6,
}

export interface ModelRepresentation {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  createdBy?: string;
  lastUpdatedBy?: string;
  /** Epoch milliseconds. */
  lastUpdated?: number;
  latestVersion?: boolean;
  version?: number;
  comment?: string | null;
  modelType?: ModelType;
  tenantId?: string | null;
}

export interface NewModel {
  name: string;
  key: string;
  description?: string;
  modelType: ModelType;
}

export interface ResultList<T> {
  size: number;
  total: number;
  start: number;
  data: T[];
}

export interface GroupRepresentation {
  id: string;
  name: string;
  type?: string;
}

export interface UserRepresentation {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  fullName?: string;
  tenantId?: string;
  groups?: GroupRepresentation[];
  privileges?: string[];
}

export type ModelSort = 'modifiedDesc' | 'modifiedAsc' | 'nameAsc' | 'nameDesc';

export interface ModelQuery {
  filter: string;
  modelType: ModelType;
  sort: ModelSort;
  filterText?: string;
}

/** Error body returned by the Flowable UI REST layer (`ErrorInfo`). */
export interface FlowableError {
  message?: string;
  messageKey?: string;
  customData?: Record<string, unknown>;
}

/** A form field as stored in `formDefinition.fields`; containers hold their children per column in `fields`. */
export interface FormField {
  id: string;
  name?: string;
  type: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string | null;
  options?: { id?: string; name: string }[];
  fields?: Record<string, FormField[]>;
  params?: Record<string, unknown>;
}

export interface FormRepresentation extends ModelRepresentation {
  formDefinition: {
    fields?: FormField[];
    outcomes?: { id?: string; name: string }[];
  };
}

export interface DecisionTableExpression {
  id: string;
  label?: string;
  variableId?: string;
  type?: string;
  entries?: string[];
}

export interface DecisionTableRepresentation extends ModelRepresentation {
  decisionTableDefinition: {
    key?: string;
    hitPolicy?: string;
    collectOperator?: string;
    inputExpressions?: DecisionTableExpression[];
    outputExpressions?: DecisionTableExpression[];
    rules?: Record<string, string>[];
    forceDMN11?: boolean;
  };
}

export interface AppModelReference {
  id: string;
  name: string;
  version?: number;
  modelType?: ModelType;
  description?: string;
  lastUpdatedBy?: string;
  lastUpdated?: number;
}

export interface AppDefinitionRepresentation {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  version?: number;
  definition: {
    models?: AppModelReference[];
    cmmnModels?: AppModelReference[];
    theme?: string;
    icon?: string;
    usersAccess?: string;
    groupsAccess?: string;
  };
}

/** `POST /rest/models/{id}/history/{historyId}` answers with the models the restored version refers to but cannot find. */
export interface ReviveResult {
  unresolvedModels?: {
    unresolveModelId: string;
    unresolvedModelName: string;
    unresolvedModelType: string;
  }[];
}
