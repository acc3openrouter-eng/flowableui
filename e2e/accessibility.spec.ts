import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';
import { ModelKind, expect, test } from './fixtures';

/** Serious and critical WCAG 2.1 A/AA problems on the page, as readable lines. */
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

test.describe('accessibility', () => {
  test('sign-in page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/#/login');
    await expect(page.locator('input[name=username]')).toBeVisible();
    expect(await audit(page)).toEqual([]);
    await context.close();
  });

  for (const path of [
    'processes',
    'casemodels',
    'forms',
    'decision-tables',
    'decision-services',
    'apps',
  ]) {
    test(`${path} library`, async ({ page }) => {
      await page.goto(`/#/${path}`);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await audit(page)).toEqual([]);
    });
  }

  const editors: [ModelKind, string, string, string][] = [
    ['process', 'processes', 'editor', 'fm-diagram-canvas'],
    ['case', 'casemodels', 'case-editor', 'fm-diagram-canvas'],
    ['decisionService', 'decision-services', 'decision-service-editor', 'fm-diagram-canvas'],
    ['form', 'forms', 'form-editor', '.palette-item'],
    ['decisionTable', 'decision-tables', 'decision-table-editor', 'table.dt'],
    ['app', 'apps', 'app-editor', '.editor-header'],
  ];
  for (const [kind, library, editor, ready] of editors) {
    test(`${kind} details and editor`, async ({ page, models }) => {
      const model = await models.create(kind);
      await page.goto(`/#/${library}/${model.id}`);
      await expect(page.getByRole('heading', { name: model.name })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await audit(page)).toEqual([]);
      await page.goto(`/#/${editor}/${model.id}`);
      await expect(page.locator(ready).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await audit(page)).toEqual([]);
    });
  }

  test('dark mode', async ({ page, models }) => {
    const model = await models.create('process');
    await page.goto('/#/processes');
    await page.getByRole('button', { name: /dark/i }).click();
    await expect(page.locator('html.app-dark')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(await audit(page)).toEqual([]);
    await page.goto(`/#/editor/${model.id}`);
    await expect(page.locator('fm-diagram-canvas')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await audit(page)).toEqual([]);
  });
});
