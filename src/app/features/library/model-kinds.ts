import { ModelType } from '../../core/api/api.types';
import { ApiUrls } from '../../core/api/api-urls';

export interface ModelExport {
  label: string;
  url: (urls: ApiUrls, modelId: string, historyId?: string) => string;
}

export type ModelPreview = 'diagram' | 'form' | 'decision-table' | 'app';

/** Everything the generic library, create and import screens need to know about one model type. */
export interface ModelKind {
  id: 'processes' | 'casemodels' | 'forms' | 'decision-tables' | 'decision-services' | 'apps';
  modelType: ModelType;
  /** `filter` query parameter of `GET /rest/models`. */
  filter: string;
  /** Translation prefix of the list page, e.g. `PROCESS-LIST`. */
  listI18n: string;
  /** Translation prefix of the list filter labels, e.g. `PROCESSES` in `PROCESS-LIST.FILTER.PROCESSES-COUNT`. */
  filterI18n: string;
  /** Translation prefix of a single model, e.g. `PROCESS`. */
  itemI18n: string;
  createLabel: string;
  importLabel?: string;
  importUrl?: (urls: ApiUrls, options: { renewIdmIds: boolean }) => string;
  /** App imports can re-link user and group ids to the target environment. */
  importRenewsIdmIds?: boolean;
  importAccept?: string;
  /** Route of the details page (`/processes/:id`). */
  route: string;
  /** Route of the visual editor (`/editor/:id`). */
  editorRoute: string;
  icon: string;
  /** Whether the server stores a thumbnail for this model type (the card falls back to the icon). */
  hasThumbnail: boolean;
  /** How the details page previews the model. */
  preview: ModelPreview;
  exports: ModelExport[];
}

export const MODEL_KINDS: Record<ModelKind['id'], ModelKind> = {
  processes: {
    id: 'processes',
    modelType: ModelType.Bpmn,
    filter: 'processes',
    listI18n: 'PROCESS-LIST',
    filterI18n: 'PROCESSES',
    itemI18n: 'PROCESS',
    createLabel: 'PROCESS-LIST.ACTION.CREATE',
    importLabel: 'PROCESS-LIST.ACTION.IMPORT',
    importUrl: (urls) => urls.importProcessModel(),
    importAccept: '.bpmn,.bpmn20.xml,.xml',
    route: '/processes',
    editorRoute: '/editor',
    icon: 'pi pi-sitemap',
    hasThumbnail: true,
    preview: 'diagram',
    exports: [
      { label: 'PROCESS.ACTION.EXPORT_BPMN20', url: (u, id, h) => u.modelBpmnExport(id, h) },
    ],
  },
  casemodels: {
    id: 'casemodels',
    modelType: ModelType.Cmmn,
    filter: 'cases',
    listI18n: 'CASE-LIST',
    filterI18n: 'CASES',
    itemI18n: 'CASE',
    createLabel: 'CASE-LIST.ACTION.CREATE',
    importLabel: 'CASE-LIST.ACTION.IMPORT',
    importUrl: (urls) => urls.importCaseModel(),
    importAccept: '.cmmn,.cmmn.xml,.xml',
    route: '/casemodels',
    editorRoute: '/case-editor',
    icon: 'pi pi-briefcase',
    hasThumbnail: true,
    preview: 'diagram',
    exports: [{ label: 'CASE.ACTION.EXPORT_CMMN', url: (u, id, h) => u.cmmnExport(id, h) }],
  },
  forms: {
    id: 'forms',
    modelType: ModelType.Form,
    filter: 'forms',
    listI18n: 'FORMS-LIST',
    filterI18n: 'FORMS',
    itemI18n: 'FORM',
    createLabel: 'FORMS-LIST.ACTION.CREATE',
    route: '/forms',
    editorRoute: '/form-editor',
    icon: 'pi pi-file-edit',
    hasThumbnail: true,
    preview: 'form',
    exports: [],
  },
  'decision-tables': {
    id: 'decision-tables',
    modelType: ModelType.DecisionTable,
    filter: 'decisionTables',
    listI18n: 'DECISIONS-LIST',
    filterI18n: 'DECISION-TABLES',
    itemI18n: 'DECISION-TABLE',
    createLabel: 'DECISIONS-LIST.ACTION.CREATE',
    importLabel: 'DECISIONS-LIST.ACTION.IMPORT-DECISION-TABLE',
    importUrl: (urls) => urls.importDecisionTable(),
    importAccept: '.dmn,.xml',
    route: '/decision-tables',
    editorRoute: '/decision-table-editor',
    icon: 'pi pi-table',
    hasThumbnail: true,
    preview: 'decision-table',
    exports: [
      { label: 'DECISION-TABLE.ACTION.EXPORT', url: (u, id, h) => u.decisionTableExport(id, h) },
    ],
  },
  'decision-services': {
    id: 'decision-services',
    modelType: ModelType.DecisionService,
    filter: 'decisionServices',
    listI18n: 'DECISIONS-LIST',
    filterI18n: 'DECISION-SERVICES',
    itemI18n: 'DECISION-SERVICE',
    createLabel: 'DECISIONS-LIST.ACTION.CREATE-DECISION-SERVICE',
    importLabel: 'DECISIONS-LIST.ACTION.IMPORT-DECISION-SERVICE',
    importUrl: (urls) => urls.importDecisionServiceModel(),
    importAccept: '.dmn,.xml',
    route: '/decision-services',
    editorRoute: '/decision-service-editor',
    icon: 'pi pi-share-alt',
    hasThumbnail: true,
    preview: 'diagram',
    exports: [{ label: 'DECISION-SERVICE.ACTION.EXPORT', url: (u, id, h) => u.dmnExport(id, h) }],
  },
  apps: {
    id: 'apps',
    modelType: ModelType.App,
    filter: 'apps',
    listI18n: 'APPS-LIST',
    filterI18n: 'APPS',
    itemI18n: 'APP',
    createLabel: 'APPS-LIST.ACTION.CREATE',
    importLabel: 'APPS-LIST.ACTION.IMPORT',
    importUrl: (urls, { renewIdmIds }) => urls.importAppDefinition(renewIdmIds),
    importRenewsIdmIds: true,
    importAccept: '.zip,.bar',
    route: '/apps',
    editorRoute: '/app-editor',
    icon: 'pi pi-th-large',
    hasThumbnail: false,
    preview: 'app',
    exports: [
      { label: 'APP.ACTION.EXPORT-ZIP', url: (u, id) => u.appDefinitionExport(id) },
      { label: 'APP.ACTION.EXPORT-BAR', url: (u, id) => u.appDefinitionBarExport(id) },
    ],
  },
};

export const modelKindForType = (type: ModelType | undefined): ModelKind | undefined =>
  Object.values(MODEL_KINDS).find((kind) => kind.modelType === type);
