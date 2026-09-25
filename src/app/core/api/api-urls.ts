import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config';

/** Every Flowable Modeler REST endpoint, ported from the original `url-config.js`. */
@Injectable({ providedIn: 'root' })
export class ApiUrls {
  private readonly config = inject(AppConfigService);

  private get rest(): string {
    return `${this.config.modelerRestRoot}/rest`;
  }

  // Account
  account = () => `${this.rest}/account`;
  logout = () => `${this.config.contextRoot}/app/logout`;
  authentication = () => `${this.config.contextRoot}/app/authentication`;
  idmLogin = (redirectUrl: string) =>
    `${this.config.contextRoot}/idm/#/login?redirectOnAuthSuccess=true&redirectUrl=${encodeURIComponent(redirectUrl)}`;
  aboutInfo = () => `${this.rest}/about-info`;

  // Models
  models = () => `${this.rest}/models`;
  model = (modelId: string) => `${this.rest}/models/${modelId}`;
  modelJson = (modelId: string) => `${this.rest}/models/${modelId}/model-json`;
  modelEditorJson = (modelId: string) => `${this.rest}/models/${modelId}/editor/json`;
  modelBpmnExport = (modelId: string, historyId?: string) =>
    `${this.rest}/models/${modelId}${historyId ? `/history/${historyId}` : ''}/bpmn20?version=${Date.now()}`;
  modelClone = (modelId: string) => `${this.rest}/models/${modelId}/clone`;
  modelHistories = (modelId: string) => `${this.rest}/models/${modelId}/history`;
  modelHistory = (modelId: string, historyId: string) =>
    `${this.rest}/models/${modelId}/history/${historyId}`;
  modelHistoryJson = (modelId: string, historyId: string) =>
    `${this.rest}/models/${modelId}/history/${historyId}/model-json`;
  modelNewVersion = (modelId: string) => `${this.rest}/models/${modelId}/newversion`;
  modelParentRelations = (modelId: string) => `${this.rest}/models/${modelId}/parent-relations`;
  modelThumbnail = (modelId: string, version?: number | string) =>
    `${this.rest}/models/${modelId}/thumbnail${version ? `?version=${version}` : ''}`;
  modelValidate = () => `${this.rest}/model/validate`;
  cmmnExport = (modelId: string, historyId?: string) =>
    `${this.rest}/models/${modelId}${historyId ? `/history/${historyId}` : ''}/cmmn?version=${Date.now()}`;

  // Import
  importProcessModel = () => `${this.rest}/import-process-model`;
  importCaseModel = () => `${this.rest}/import-case-model`;
  importDecisionServiceModel = () => `${this.rest}/import-decision-service-model`;
  importDecisionTable = () => `${this.rest}/decision-table-models/import-decision-table`;
  importAppDefinition = (renewIdmIds: boolean) =>
    `${this.rest}/app-definitions/import?renewIdmEntries=${renewIdmIds}`;
  importIntoAppDefinition = (modelId: string, renewIdmIds: boolean) =>
    `${this.rest}/app-definitions/${modelId}/import?renewIdmEntries=${renewIdmIds}`;

  // App definitions
  appDefinition = (modelId: string) => `${this.rest}/app-definitions/${modelId}`;
  appDefinitionPublish = (modelId: string) => `${this.rest}/app-definitions/${modelId}/publish`;
  appDefinitionExport = (modelId: string) =>
    `${this.rest}/app-definitions/${modelId}/export?version=${Date.now()}`;
  appDefinitionBarExport = (modelId: string) =>
    `${this.rest}/app-definitions/${modelId}/export-bar?version=${Date.now()}`;
  appDefinitionHistory = (modelId: string, historyId: string) =>
    `${this.rest}/app-definitions/${modelId}/history/${historyId}`;
  modelsForAppDefinition = () => `${this.rest}/models-for-app-definition`;
  cmmnModelsForAppDefinition = () => `${this.rest}/cmmn-models-for-app-definition`;

  // Decision tables
  decisionTableModels = () => `${this.rest}/decision-table-models`;
  decisionTableModel = (modelId: string) => `${this.rest}/decision-table-models/${modelId}`;
  decisionTableModelValues = (query: string) =>
    `${this.rest}/decision-table-models/values?${query}`;
  decisionTableModelHistory = (modelId: string, historyId: string) =>
    `${this.rest}/decision-table-models/${modelId}/history/${historyId}`;
  decisionTableExport = (modelId: string, historyId?: string) =>
    historyId
      ? `${this.rest}/decision-table-models/history/${historyId}/export?version=${Date.now()}`
      : `${this.rest}/decision-table-models/${modelId}/export?version=${Date.now()}`;

  // Decision services
  decisionServiceModels = () => `${this.rest}/decision-service-models`;
  dmnExport = (modelId: string, historyId?: string) =>
    `${this.rest}/decision-service-models/${modelId}${historyId ? `/history/${historyId}` : ''}/dmn?version=${Date.now()}`;

  // Forms
  formModels = () => `${this.rest}/form-models`;
  formModelValues = (query: string) => `${this.rest}/form-models/values?${query}`;
  formModel = (modelId: string) => `${this.rest}/form-models/${modelId}`;
  formModelHistory = (modelId: string, historyId: string) =>
    `${this.rest}/form-models/${modelId}/history/${historyId}`;

  // Editor support
  stencilSet = (kind: 'editor' | 'cmmneditor' | 'dmneditor') => `${this.rest}/stencil-sets/${kind}`;
  editorUsers = () => `${this.rest}/editor-users`;
  editorGroups = () => `${this.rest}/editor-groups`;
  image = (imageId: string) => `${this.rest}/image/${imageId}`;
}
