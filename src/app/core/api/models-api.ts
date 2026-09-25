import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiUrls } from './api-urls';
import { ModelQuery, ModelRepresentation, NewModel, ResultList } from './api.types';

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

  useAsNewVersion(modelId: string, historyId: string, comment: string): Observable<unknown> {
    return this.http.post(this.urls.modelHistory(modelId, historyId), {
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
}
