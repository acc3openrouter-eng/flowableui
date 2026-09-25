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
