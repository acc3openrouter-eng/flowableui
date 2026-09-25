import { REST, expect, save, test } from './fixtures';

test('includes a process model and saves the app', async ({ page, models }) => {
  const process = await models.create('process');
  const app = await models.create('app');
  await page.goto(`/#/app-editor/${app.id}`);
  await page.getByRole('button', { name: 'Edit included models' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Filter').fill(process.name);
  await dialog.locator('.pick', { hasText: process.name }).click();
  await dialog.getByRole('button', { name: 'Ok' }).click();
  await expect(page.locator('.model-card', { hasText: process.name })).toHaveCount(1);

  await save(page);
  const saved = await (await page.request.get(`${REST}/app-definitions/${app.id}`)).json();
  const included = saved.definition.models as { id: string }[];
  expect(included.map((m) => m.id)).toEqual([process.id]);
});
