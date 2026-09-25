import { REST, expect, test, unique } from './fixtures';

test('creates a process model, finds it and deletes it', async ({ page, models }) => {
  const name = `e2e library ${unique()}`;
  await page.goto('/#/processes');
  await page.getByRole('button', { name: 'Create Process' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=name]').fill(name);
  // The key is derived from the name.
  await expect(dialog.locator('input[name=key]')).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Save' }).click();

  // A new model opens in its editor.
  await expect(page).toHaveURL(/#\/editor\//);
  const id = page.url().split('/').pop()!;
  models.track(id);
  await expect(page.locator('g.dg-node[data-stencil=StartNoneEvent]')).toBeVisible();

  await page.goto('/#/processes');
  await page.getByPlaceholder(/search/i).fill(name);
  const card = page.locator('fm-model-card', { hasText: name });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`#/processes/${id}`));
  await expect(page.getByRole('heading', { name })).toBeVisible();

  await page.getByRole('button', { name: /delete/i }).click();
  await page
    .locator('.p-confirmdialog')
    .getByRole('button', { name: /delete/i })
    .click();
  await expect(page).toHaveURL(/#\/processes$/);
  expect((await page.request.get(`${REST}/models/${id}`)).status()).toBe(404);
});
