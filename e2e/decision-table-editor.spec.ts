import { REST, expect, save, test } from './fixtures';

test('edits a column and a rule and saves the table', async ({ page, models }) => {
  const model = await models.create('decisionTable');
  await page.goto(`/#/decision-table-editor/${model.id}`);
  await expect(page.locator('table.dt')).toBeVisible();

  await page.locator('.col-head.input .head-main').first().click();
  await page.locator('#cd-label').fill('Age');
  await page.locator('#cd-variable').fill('age');
  await page.locator('#cd-type').click();
  await page.locator('.p-select-option', { hasText: /^number$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.col-head.input').first()).toContainText('Age');

  await page.locator('tbody tr').first().locator('td.cond input').first().fill('18');
  await save(page);

  const table = await (await page.request.get(`${REST}/decision-table-models/${model.id}`)).json();
  const def = table.decisionTableDefinition;
  expect(def.inputExpressions[0]).toMatchObject({
    label: 'Age',
    variableId: 'age',
    type: 'number',
  });
  expect(JSON.stringify(def.rules[0])).toContain('18');
});
