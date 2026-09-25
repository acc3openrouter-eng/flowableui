# Flowable Modeler (Angular)

A rewrite of the [Flowable Modeler](https://github.com/flowable/flowable-engine/tree/flowable-release-6.8.1/modules/flowable-ui/flowable-ui-modeler-frontend)
(Flowable 6.8.1, AngularJS) in **Angular 22** and **[Optimus UI](https://optimus.openng.org/)** (`@openng/optimus-ui` 2.x),
with the same features and a modernized look. It talks to the unchanged Flowable UI backend and its Modeler REST API.

See [docs/PLAN.md](docs/PLAN.md) for the feature inventory and the phased plan.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | App shell, sign-in, REST client, translations, theme (light/dark) | done |
| 2 | Model libraries (list, search, sort, create, duplicate, import) and details pages (preview, history, edit, delete, export, restore, publish) | done |
| 3 | Form builder (palette with drag and drop, field properties, outcomes, save with new version, unsaved-changes guard) | done |
| 4 | Decision table editor | planned |
| 5 | App definition editor | planned |
| 6 | Diagram engine + BPMN editor | planned |
| 7 | CMMN and DMN decision service editors | planned |
| 8 | Polish, e2e tests | planned |

## Development

Requirements: Node.js 22.22.3+ or 24.15+, and a running Flowable UI 6.8.x
(for example `java -jar flowable-ui.war` from the Flowable 6.8.1 distribution, or the `flowable/flowable-ui` Docker image).

```bash
npm install
npm start          # http://localhost:4200, proxies /flowable-ui to http://localhost:8080
npm test -- --watch=false
npm run build      # output in dist/flowable-modeler/browser
```

Sign in with a Flowable user (the default distribution has `admin` / `test`).

## Configuration

`public/config.json` is read at startup, so one build works against any deployment:

```json
{
  "contextRoot": "/flowable-ui",
  "modelerRestRoot": "/flowable-ui/modeler-app",
  "defaultLanguage": "en"
}
```

`modelerRestRoot` defaults to `{contextRoot}/modeler-app`. The app uses the Flowable UI session cookie, so it must be served
from the same origin as the Flowable UI server (or through a reverse proxy, like the dev server does).

## Differences from the original

- URLs are kept (`#/processes`, `#/editor/:modelId`, ...), so existing bookmarks still work.
- Sign-in is a built-in page that posts to the Flowable UI form login instead of redirecting to the IDM app.
- Dark mode, responsive layout, and keyboard-accessible navigation are new.
- The form builder edits fields in a side panel instead of a popup, can add fields by click as well as by drag,
  warns about duplicate field ids, and draws the form thumbnail itself instead of using html2canvas.

## License

Apache 2.0, like Flowable.
