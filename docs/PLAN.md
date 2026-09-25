# Flowable Modeler rewrite: inventory and phased plan

Source: flowable-engine `flowable-release-6.8.1`, `modules/flowable-ui/flowable-ui-modeler-frontend` (AngularJS 1.x + Oryx editor).
Target: Angular 22 + Optimus UI (`@openng/optimus-ui` 2.x, the line built for Angular 22) in `acc3openrouter-eng/flowableui`.
Backend: unchanged Flowable Modeler REST API (`{contextRoot}/modeler-app/rest/...`), IDM cookie auth (`/app/rest/account`, `/app/logout`).

## Feature inventory (original app)

**Shell**: top nav (Processes, Case Models, Forms, Decisions, Apps), account menu, logout, About, alerts/toasts, i18n (en, es, fr, ja-JP, pt-BR, zh-CN, zh-TW).

**Model libraries** (`/processes`, `/casemodels`, `/forms`, `/decisions` with Decision tables + Decision services tabs, `/apps`):
- grid of model cards with thumbnail, filter (all / mine / shared), sort (modified desc/asc, name asc/desc), text search
- create, import (file upload BPMN/CMMN/DMN/XLS/zip/bar), duplicate, delete

**Model details** (`/processes/:id`, etc., plus `/history/:historyId`):
- read-only diagram / form / table preview, metadata, version history popover
- open editor, edit name/key/description, duplicate, delete, export (BPMN XML, CMMN XML, DMN, app zip/bar)
- use an old version as new version, parent relations ("used in"), app publish

**Editors**
1. BPMN process editor (`/editor/:id`, Oryx): stencil palette, canvas with drag/connect/dock, property panel with ~45 custom property editors (assignment, listeners, form properties, multi-instance, signal/message/escalation definitions, data objects, in/out params, form/decision/process references, HTTP request, conditions, due date, sequence flow order, exceptions, event registry...), toolbar (save, validate, undo/redo, cut/copy/paste, delete, align, same size, zoom, bendpoints, morph shape), process navigator, define data, save dialog (new version, comment), unsaved-changes guard, validation panel, guided tour.
2. CMMN case editor (`/case-editor/:id`): same engine with CMMN 1.1 stencils (stages, plan items, sentries, milestones, lifecycle listeners, variable aggregations...).
3. DMN decision service editor (`/decision-service-editor/:id`): DRD canvas with decision service + decision table references.
4. Decision table editor (`/decision-table-editor/:id`): grid, hit policy, input/output columns with expression editors, rules add/move/delete, force DMN 1.1 flag, save.
5. Form builder (`/form-editor/:id`): drag-drop palette (text, multiline, password, integer, decimal, boolean, date, dropdown, radio, people, group, upload, expression, hyperlink, header/container, spacer...), field popover editor (id, label, required, readonly, placeholder, options, visibility), outcomes, save.
6. App definition editor (`/app-editor/:id`): pick included process/case models, icon + theme, users/groups, save, publish, export/import.

## Key architecture decision: the diagram editors

The API stores process, case and decision-service models only as Oryx editor JSON (`POST /rest/models/{id}/editor/json` with `json_xml`, `svg_xml`), and the server converts it to BPMN/CMMN/DMN XML. So the new editors must read and write that JSON.

Default chosen: a new Angular diagram engine (SVG, signals-based) driven by the stencil sets the API already serves (`/rest/stencil-sets/editor`, `/cmmneditor`, `/dmneditor`). The stencil set defines shapes, rules (connections, containment, morphing) and property packages, so the palette and property panel are generated, and custom property editors are ported one by one. Rejected: embedding the old Oryx/Prototype.js editor (not a rewrite), and bpmn-js (would need a client-side port of Flowable's BPMN XML to editor JSON converter and still leaves CMMN/DRD).

## Phases (each lands as its own PR)

1. **Foundation**: Angular 22 workspace, Optimus UI theme, app shell and routing that matches the old URLs, runtime config (`contextRoot`), auth guard and HTTP interceptor, API client for every endpoint, dev proxy to a running Flowable UI, i18n with the original translation files, lint and unit tests.
2. **Model libraries and details** for all five model types, including create/import/duplicate/delete/export, history, use as new version, relations.
3. **Form builder** (CDK drag and drop).
4. **Decision table editor**.
5. **App definition editor** and publish.
6. **Diagram engine + BPMN editor** (largest phase: canvas, palette, property panel, toolbar, validation, save, thumbnails).
7. **CMMN editor and DMN decision service editor** on the same engine.
8. **Polish**: remaining property editors, keyboard shortcuts, tour, accessibility, e2e tests against a Flowable Docker image.
