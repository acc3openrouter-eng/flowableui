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
| 4 | Decision table editor (hit policy, input and output columns with allowed values, rules, Force DMN 1.1, save with new version) | done |
| 5 | App definition editor (icon, theme, access, included process and case models, save and publish) | done |
| 6 | Diagram engine + BPMN process editor (palette, canvas, quick menu, morph, property panel with all property editors, undo, copy and paste, align, zoom, save with conflict handling, validation) | done |
| 7 | CMMN case model editor and DMN decision service editor on the same diagram engine | done |
| 8 | Polish: collapsed sub-process editing, keyboard shortcuts, guided tour, accessibility audit, end-to-end tests in CI against Flowable | done |

## Development

Requirements: Node.js 22.22.3+ or 24.15+, and a running Flowable UI 6.8.x
(for example `java -jar flowable-ui.war` from the Flowable 6.8.1 distribution, or the `flowable/flowable-ui` Docker image).

```bash
npm install
npm start          # http://localhost:4200, proxies /flowable-ui to http://localhost:8080
npm test -- --watch=false
npm run build      # output in dist/flowable-modeler/browser
```

### End-to-end tests

The Playwright tests in `e2e/` drive the app against a running Flowable UI: they sign in, create throwaway models
through the REST API (and delete them afterwards), edit them in every editor, and check what the server exports.
They also run an [axe](https://github.com/dequelabs/axe-core) accessibility audit on every page.

```bash
npx playwright install chromium   # once
npm run e2e                       # starts the dev server unless E2E_BASE_URL is set
```

Settings: `E2E_BASE_URL` (an already running app), `E2E_USER` / `E2E_PASSWORD` (default `admin` / `test`), and
`E2E_CHROMIUM` (path to a Chromium binary to use instead of Playwright's). CI runs the suite against the
`flowable/flowable-ui:6.8.0` Docker image, the last one published for 6.8.

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
- The decision table editor is a plain HTML grid instead of Handsontable: cells are native inputs and selects,
  number and date cells are highlighted when invalid, and rule actions sit on each rule number.
- The app definition editor shows a live preview of the app tile, picks icons from a grid instead of a dropdown,
  and picks included models as selectable cards with thumbnails. Bootstrap glyphicons are mapped to Optimus icons
  for display but stored unchanged, so apps stay compatible with the Flowable task app.
- The BPMN editor replaces Oryx with its own SVG engine that draws shapes from the same stencil set and reads and
  writes the same editor JSON. Differences you will notice:
  - The property panel sits on the right, edits simple properties inline (text properties too, instead of a popup),
    and can be filtered. The palette can be searched and a click adds an element in the middle of the view.
  - Bend points are added by dragging a flow segment's midpoint and removed by double-clicking them, so the
    bend point toolbar buttons are gone. The help button lists the editing tips and starts the guided tour, which
    has Back buttons and highlights each area instead of showing animations.
  - Deleting a shape also deletes its flows, Ctrl+X cuts, Backspace deletes and Ctrl+S opens the save dialog.
  - The quick menu steps new shapes down when the spot east of the source is taken, instead of stacking them.
  - On a save conflict you can overwrite or create a new version; "save as" is left out because it fails in 6.8.1.
  - The canvas stays light in dark mode, like a sheet of paper.
  - A collapsed sub-process opens on its own canvas from the pencil under it (or Enter); a breadcrumb in the toolbar
    leads back. There is no separate process navigator panel.
  - Keyboard: Enter and Tab / Shift+Tab select elements, + / - / 0 zoom, and the selection is announced to screen
    readers. Ctrl+S opens the save dialog in every editor.
- The case model editor and the decision service editor run on the same engine. Beyond the points above:
  - Entry and exit criteria dock on a task, stage or plan model border when dropped there, instead of being lost
    on save. Plan items can only be dropped inside the plan model, and the plan model cannot be deleted.
  - The "Start trigger plan item" picker of a timer listener lists the case's plan items (it is always empty in
    6.8.1), and the ID variable property is saved under the key the converter reads.
  - Associations and information requirements are drawn from the quick menu; the palette entries that fail in
    6.8.1 are left out. Validate is only offered for process models, as before.
  - The decision service and its two sections cannot be deleted, and the sections are captioned
    "Output decisions" and "Encapsulated decisions".
  - The case and decision table reference pickers select existing models only; creating or opening a model from
    the picker is left out.

## License

Apache 2.0, like Flowable.
