import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

const library = (kind: string, title: string) => ({
  loadComponent: () => import('./features/library/model-library').then((m) => m.ModelLibrary),
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

      // Details pages (phase 2).
      { path: 'processes/:modelId', ...soon('Process model details', '/processes') },
      {
        path: 'processes/:modelId/history/:modelHistoryId',
        ...soon('Process model history', '/processes'),
      },
      { path: 'casemodels/:modelId', ...soon('Case model details', '/casemodels') },
      {
        path: 'casemodels/:modelId/history/:modelHistoryId',
        ...soon('Case model history', '/casemodels'),
      },
      { path: 'forms/:modelId', ...soon('Form details', '/forms') },
      { path: 'forms/:modelId/history/:modelHistoryId', ...soon('Form history', '/forms') },
      { path: 'decision-tables/:modelId', ...soon('Decision table details', '/decision-tables') },
      {
        path: 'decision-tables/:modelId/history/:modelHistoryId',
        ...soon('Decision table history', '/decision-tables'),
      },
      {
        path: 'decision-services/:modelId',
        ...soon('Decision service details', '/decision-services'),
      },
      {
        path: 'decision-services/:modelId/history/:modelHistoryId',
        ...soon('Decision service history', '/decision-services'),
      },
      { path: 'apps/:modelId', ...soon('App definition details', '/apps') },
      { path: 'apps/:modelId/history/:modelHistoryId', ...soon('App definition history', '/apps') },

      // Editors (phases 3 to 7).
      { path: 'form-editor/:modelId', ...soon('Form editor', '/forms') },
      {
        path: 'decision-table-editor/:modelId',
        ...soon('Decision table editor', '/decision-tables'),
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
