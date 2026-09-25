import { REST, expect, save, test } from './fixtures';

test('adds fields and outcomes and saves the form', async ({ page, models }) => {
  const model = await models.create('form');
  await page.goto(`/#/form-editor/${model.id}`);
  await page.locator('.palette-item', { hasText: 'Text' }).first().click();
  await page.locator('#fp-label').fill('Full name');
  await expect(page.locator('#fp-id')).toHaveValue('fullname');
  await page.locator('.palette-item', { hasText: 'Dropdown' }).click();
  await page.locator('#fp-label').fill('Country');
  await expect(page.locator('.field-card')).toHaveCount(2);

  await save(page);
  const form = await (await page.request.get(`${REST}/form-models/${model.id}`)).json();
  const fields = form.formDefinition.fields as { id: string; name: string; type: string }[];
  expect(fields.map((f) => [f.id, f.name, f.type])).toEqual([
    ['fullname', 'Full name', 'text'],
    ['country', 'Country', 'dropdown'],
  ]);
});
