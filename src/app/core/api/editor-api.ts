import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ModelJson } from '../../shared/diagram-editor/diagram-model';
import { StencilSetJson } from '../../shared/diagram-editor/stencil-set';
import { ApiUrls } from './api-urls';
import { ModelRepresentation, ResultList } from './api.types';

/** `GET /rest/models/{id}/editor/json`. */
export interface EditorModel {
  modelId: string;
  name: string;
  key: string;
  description: string | null;
  lastUpdated: number | string;
  lastUpdatedBy?: string;
  model: ModelJson;
}

export interface EditorSaveRequest {
  json: ModelJson;
  name: string;
  key: string;
  description: string;
  newVersion: boolean;
  comment: string;
  lastUpdated: number | string;
  /** Only after a 409: how to resolve the conflict. */
  conflictResolveAction?: 'overwrite' | 'newVersion';
}

/** Body of a 409 when someone else saved the model in the meantime. */
export interface SaveConflict {
  message: string;
  customData?: { userFullName?: string; newVersionAllowed?: boolean };
}

export interface ValidationError {
  validatorSetName?: string;
  problem: string;
  defaultDescription: string;
  processDefinitionId?: string;
  activityId?: string;
  activityName?: string | null;
  warning: boolean;
}

export interface EditorUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  fullName?: string | null;
  [key: string]: unknown;
}

export interface EditorGroup {
  id: string;
  name?: string | null;
  [key: string]: unknown;
}

/** Endpoints used by the diagram editors. */
@Injectable({ providedIn: 'root' })
export class EditorApi {
  private readonly http = inject(HttpClient);
  private readonly urls = inject(ApiUrls);

  editorJson(modelId: string): Observable<EditorModel> {
    return this.http.get<EditorModel>(this.urls.modelEditorJson(modelId), {
      params: { version: Date.now() },
    });
  }

  stencilSet(kind: 'editor' | 'cmmneditor' | 'dmneditor'): Observable<StencilSetJson> {
    return this.http.get<StencilSetJson>(this.urls.stencilSet(kind), {
      params: { version: Date.now() },
    });
  }

  /** Saves the editor JSON as a form post, the only format the server accepts. */
  save(modelId: string, request: EditorSaveRequest): Observable<ModelRepresentation> {
    const fields: Record<string, string> = {
      modeltype: 'model',
      json_xml: JSON.stringify(request.json),
      name: request.name,
      key: request.key,
      description: request.description ?? '',
      newversion: String(request.newVersion),
      comment: request.comment ?? '',
      lastUpdated: String(request.lastUpdated),
    };
    if (request.conflictResolveAction)
      fields['conflictResolveAction'] = request.conflictResolveAction;
    // Encoded by hand: HttpParams leaves "+" as is, which the server would read as a space.
    const body = Object.entries(fields)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return this.http.post<ModelRepresentation>(this.urls.modelEditorJson(modelId), body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    });
  }

  validate(model: ModelJson): Observable<ValidationError[]> {
    return this.http.post<ValidationError[]>(this.urls.modelValidate(), model);
  }

  users(filter: string): Observable<ResultList<EditorUser>> {
    return this.http.get<ResultList<EditorUser>>(this.urls.editorUsers(), { params: { filter } });
  }

  groups(filter: string): Observable<ResultList<EditorGroup>> {
    const params: Record<string, string> = filter ? { filter } : {};
    return this.http.get<ResultList<EditorGroup>>(this.urls.editorGroups(), { params });
  }

  formModels(): Observable<ResultList<ModelRepresentation>> {
    return this.http.get<ResultList<ModelRepresentation>>(this.urls.formModels());
  }

  decisionTableModels(): Observable<ResultList<ModelRepresentation>> {
    return this.http.get<ResultList<ModelRepresentation>>(this.urls.decisionTableModels());
  }

  decisionServiceModels(): Observable<ResultList<ModelRepresentation>> {
    return this.http.get<ResultList<ModelRepresentation>>(this.urls.decisionServiceModels());
  }
}
