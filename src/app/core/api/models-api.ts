import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrls } from './api-urls';
import {
  AppDefinitionRepresentation,
  DecisionTableRepresentation,
  DecisionTableSaveRepresentation,
  FormRepresentation,
  FormSaveRepresentation,
  ModelQuery,
  ModelRepresentation,
  NewModel,
  ResultList,
  ReviveResult,
} from './api.types';
import { DisplayModel } from '../../shared/diagram-viewer/display-model';

/** Model CRUD shared by every model type (processes, case models, forms, decisions, apps). */
@Injectable({ providedIn: 'root' })
export class ModelsApi {
  private readonly http = inject(HttpClient);
  private readonly urls = inject(ApiUrls);

  list(query: ModelQuery): Observable<ResultList<ModelRepresentation>> {
    let params = new HttpParams()
      .set('filter', query.filter)
      .set('sort', query.sort)
      .set('modelType', query.modelType);
    if (query.filterText) {
      params = params.set('filterText', query.filterText);
    }
    return this.http.get<ResultList<ModelRepresentation>>(this.urls.models(), { params });
  }

  get(modelId: string): Observable<ModelRepresentation> {
    return this.http.get<ModelRepresentation>(this.urls.model(modelId));
  }

  create(model: NewModel): Observable<ModelRepresentation> {
    return this.http.post<ModelRepresentation>(this.urls.models(), model);
  }

  update(modelId: string, model: Partial<ModelRepresentation>): Observable<ModelRepresentation> {
    return this.http.put<ModelRepresentation>(this.urls.model(modelId), model);
  }

  duplicate(modelId: string, model: NewModel): Observable<ModelRepresentation> {
    return this.http.post<ModelRepresentation>(this.urls.modelClone(modelId), model);
  }

  delete(modelId: string): Observable<void> {
    return this.http.delete<void>(this.urls.model(modelId));
  }

  history(
    modelId: string,
    includeLatestVersion = true,
  ): Observable<ResultList<ModelRepresentation>> {
    return this.http.get<ResultList<ModelRepresentation>>(this.urls.modelHistories(modelId), {
      params: { includeLatestVersion },
    });
  }

  historyVersion(modelId: string, historyId: string): Observable<ModelRepresentation> {
    return this.http.get<ModelRepresentation>(this.urls.modelHistory(modelId, historyId));
  }

  useAsNewVersion(
    modelId: string,
    historyId: string,
    comment: string,
  ): Observable<ReviveResult | null> {
    return this.http.post<ReviveResult | null>(this.urls.modelHistory(modelId, historyId), {
      action: 'useAsNewVersion',
      comment,
    });
  }

  parentRelations(modelId: string): Observable<ModelRepresentation[]> {
    return this.http.get<ModelRepresentation[]>(this.urls.modelParentRelations(modelId));
  }

  /** Uploads a model file (BPMN, CMMN, DMN, XLS, app zip/bar) as multipart form data under the `file` field. */
  import(url: string, file: File): Observable<ModelRepresentation> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ModelRepresentation>(url, body);
  }

  /** Display JSON used by the read-only diagram (processes, case models, decision services). */
  displayJson(modelId: string, historyId?: string): Observable<DisplayModel> {
    return this.http.get<DisplayModel>(
      historyId ? this.urls.modelHistoryJson(modelId, historyId) : this.urls.modelJson(modelId),
    );
  }

  form(modelId: string, historyId?: string): Observable<FormRepresentation> {
    return this.http.get<FormRepresentation>(
      historyId ? this.urls.formModelHistory(modelId, historyId) : this.urls.formModel(modelId),
    );
  }

  decisionTable(modelId: string, historyId?: string): Observable<DecisionTableRepresentation> {
    return this.http.get<DecisionTableRepresentation>(
      historyId
        ? this.urls.decisionTableModelHistory(modelId, historyId)
        : this.urls.decisionTableModel(modelId),
    );
  }

  appDefinition(modelId: string, historyId?: string): Observable<AppDefinitionRepresentation> {
    return this.http.get<AppDefinitionRepresentation>(
      historyId
        ? this.urls.appDefinitionHistory(modelId, historyId)
        : this.urls.appDefinition(modelId),
    );
  }

  /** Saves a form definition (`PUT /rest/form-models/{id}`). The server requires a PNG thumbnail. */
  saveForm(modelId: string, body: FormSaveRepresentation): Observable<FormRepresentation> {
    return this.http.put<FormRepresentation>(this.urls.formModel(modelId), body);
  }

  /** Saves a decision table (`PUT /rest/decision-table-models/{id}`). */
  saveDecisionTable(
    modelId: string,
    body: DecisionTableSaveRepresentation,
  ): Observable<DecisionTableRepresentation> {
    return this.http.put<DecisionTableRepresentation>(this.urls.decisionTableModel(modelId), body);
  }

  publishApp(
    modelId: string,
    comment: string,
    force = false,
  ): Observable<{ error?: boolean; errorDescription?: string }> {
    return this.http.post<{ error?: boolean; errorDescription?: string }>(
      this.urls.appDefinitionPublish(modelId),
      {
        comment,
        ...(force ? { force: true } : {}),
      },
    );
  }
}
