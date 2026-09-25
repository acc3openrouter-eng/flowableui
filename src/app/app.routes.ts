import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

const library = (kind: string, title: string) => ({
  loadComponent: () => import('./features/library/model-library').then((m) => m.ModelLibrary),
  data: { kind },
  title: `${title} · Flowable Modeler`,
});

const details = (kind: string, title: string) => ({
  loadComponent: () => import('./features/details/model-details').then((m) => m.ModelDetails),
  data: { kind },
  title: `${title} · Flowable Modeler`,
});

const soon = (title: string, back: string) => ({
  loadComponent: () => import('./features/placeholder/coming-soon').then((m) => m.ComingSoon),
  data: { title, back },
  title: `${title} · Flowable Modeler`,
});

/** Same URLs as the original AngularJS Modeler (`#/processes`, `#/editor/:modelId`, ...). */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Sign in · Flowable Modeler',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'processes' },
      { path: 'processes', ...library('processes', 'Processes') },
      { path: 'casemodels', ...library('casemodels', 'Case models') },
      { path: 'forms', ...library('forms', 'Forms') },
      { path: 'decisions', pathMatch: 'full', redirectTo: 'decision-tables' },
      { path: 'decision-tables', ...library('decision-tables', 'Decision tables') },
      { path: 'decision-services', ...library('decision-services', 'Decision services') },
      { path: 'apps', ...library('apps', 'Apps') },

      // Details pages, for the latest version and for a historic one.
      { path: 'processes/:modelId', ...details('processes', 'Process model') },
      {
        path: 'processes/:modelId/history/:modelHistoryId',
        ...details('processes', 'Process model history'),
      },
      { path: 'casemodels/:modelId', ...details('casemodels', 'Case model') },
      {
        path: 'casemodels/:modelId/history/:modelHistoryId',
        ...details('casemodels', 'Case model history'),
      },
      { path: 'forms/:modelId', ...details('forms', 'Form') },
      { path: 'forms/:modelId/history/:modelHistoryId', ...details('forms', 'Form history') },
      { path: 'decision-tables/:modelId', ...details('decision-tables', 'Decision table') },
      {
        path: 'decision-tables/:modelId/history/:modelHistoryId',
        ...details('decision-tables', 'Decision table history'),
      },
      { path: 'decision-services/:modelId', ...details('decision-services', 'Decision service') },
      {
        path: 'decision-services/:modelId/history/:modelHistoryId',
        ...details('decision-services', 'Decision service history'),
      },
      { path: 'apps/:modelId', ...details('apps', 'App definition') },
      {
        path: 'apps/:modelId/history/:modelHistoryId',
        ...details('apps', 'App definition history'),
      },

      // Editors (phases 3 to 7).
      {
        path: 'form-editor/:modelId',
        loadComponent: () => import('./features/form-editor/form-editor').then((m) => m.FormEditor),
        canDeactivate: [unsavedChangesGuard],
        title: 'Form editor · Flowable Modeler',
      },
      {
        path: 'decision-table-editor/:modelId',
        loadComponent: () =>
          import('./features/decision-table-editor/decision-table-editor').then(
            (m) => m.DecisionTableEditor,
          ),
        canDeactivate: [unsavedChangesGuard],
        title: 'Decision table editor · Flowable Modeler',
      },
      { path: 'app-editor/:modelId', ...soon('App definition editor', '/apps') },
      { path: 'editor/:modelId', ...soon('Process editor', '/processes') },
      { path: 'case-editor/:modelId', ...soon('Case editor', '/casemodels') },
      {
        path: 'decision-service-editor/:modelId',
        ...soon('Decision service editor', '/decision-services'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
