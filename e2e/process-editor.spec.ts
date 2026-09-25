import { REST, expect, save, test } from './fixtures';

test.describe('process editor', () => {
  test('adds, connects and names a task, then saves and exports it', async ({ page, models }) => {
    const model = await models.create('process');
    await page.goto(`/#/editor/${model.id}`);
    const start = page.locator('g.dg-node[data-stencil=StartNoneEvent]');
    await start.click();
    // The quick menu adds the next step and connects it.
    await page
      .getByRole('toolbar', { name: 'Add next element' })
      .getByRole('button', { name: 'User task' })
      .click();
    const task = page.locator('g.dg-node[data-stencil=UserTask]');
    await expect(task).toHaveCount(1);
    await expect(page.locator('g.dg-edge')).toHaveCount(1);
    await expect(page.locator('fm-property-panel .kind')).toHaveText(/User task/i);
    await page.locator('#prop-name').fill('Review order');
    await page.locator('#prop-name').press('Enter');
    await expect(task).toContainText('Review order');
    await expect(page.locator('.unsaved')).toHaveCount(1);

    await save(page);
    const xml = await (await page.request.get(`${REST}/models/${model.id}/bpmn20`)).text();
    expect(xml).toContain('<userTask');
    expect(xml).toContain('name="Review order"');
    expect(xml).toContain('<sequenceFlow');
  });

  test('undoes and redoes from the keyboard', async ({ page, models }) => {
    const model = await models.create('process');
    await page.goto(`/#/editor/${model.id}`);
    await page.locator('g.dg-node[data-stencil=StartNoneEvent]').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('g.dg-node')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator('g.dg-node')).toHaveCount(1);
    await page.keyboard.press('Control+y');
    await expect(page.locator('g.dg-node')).toHaveCount(0);
  });

  test('edits a collapsed sub-process on its own canvas', async ({ page, models }) => {
    const model = await models.create('process');
    await page.goto(`/#/editor/${model.id}`);
    await expect(page.locator('g.dg-node[data-stencil=StartNoneEvent]')).toBeVisible();
    await page.getByPlaceholder('Find an element').fill('collapsed');
    await page.locator('.stencil[data-stencil=CollapsedSubProcess]').click();
    const sub = page.locator('g.dg-node[data-stencil=CollapsedSubProcess]');
    await expect(sub).toHaveCount(1);
    await page.locator('#prop-name').fill('Ship order');
    await page.locator('#prop-name').press('Enter');

    await page.getByRole('button', { name: 'Edit sub-process' }).click();
    const trail = page.getByRole('navigation', { name: 'Open sub-processes' });
    await expect(trail).toContainText('Ship order');
    await expect(page.locator('g.dg-node')).toHaveCount(0);
    await page.getByPlaceholder('Find an element').fill('user task');
    await page.locator('.stencil[data-stencil=UserTask]').click();
    await page.locator('#prop-name').fill('Pack parcel');
    await page.locator('#prop-name').press('Enter');

    await trail.getByRole('button', { name: model.name }).click();
    await expect(trail).toHaveCount(0);
    await expect(page.locator('g.dg-node[data-stencil=UserTask]')).toHaveCount(0);
    await save(page);
    const xml = await (await page.request.get(`${REST}/models/${model.id}/bpmn20`)).text();
    expect(xml).toMatch(
      /<subProcess[^>]*name="Ship order"[\s\S]*name="Pack parcel"[\s\S]*<\/subProcess>/,
    );
  });

  test('asks before leaving with unsaved changes', async ({ page, models }) => {
    const model = await models.create('process');
    await page.goto(`/#/editor/${model.id}`);
    await page.locator('g.dg-node[data-stencil=StartNoneEvent]').click();
    await page.keyboard.press('Delete');
    await page.getByRole('link', { name: /Forms/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/unsaved changes/i);
    await dialog.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page).toHaveURL(new RegExp(`#/editor/${model.id}`));
  });
});
