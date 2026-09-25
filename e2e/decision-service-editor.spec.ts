import { REST, expect, save, test } from './fixtures';

test('places decisions in both sections and links them', async ({ page, models }) => {
  const model = await models.create('decisionService');
  await page.goto(`/#/decision-service-editor/${model.id}`);
  const output = page.locator('g.dg-node[data-stencil=OutputDecisionsDecisionServiceSection]');
  const encapsulated = page.locator(
    'g.dg-node[data-stencil=EncapsulatedDecisionsDecisionServiceSection]',
  );
  await expect(output).toBeVisible();
  const canvas = page.locator('fm-diagram-canvas .scroller');
  const canvasBox = (await canvas.boundingBox())!;
  const decision = page.locator('.stencil[data-stencil=Decision]');
  for (const section of [output, encapsulated]) {
    const box = (await section.boundingBox())!;
    await decision.dragTo(canvas, {
      targetPosition: { x: box.x - canvasBox.x + 300, y: box.y - canvasBox.y + 120 },
    });
  }
  // Not on the bare canvas.
  await decision.dragTo(canvas, { targetPosition: { x: 30, y: 30 } });
  const decisions = page.locator('g.dg-node[data-stencil=Decision]');
  await expect(decisions).toHaveCount(2);

  await decisions.nth(0).click();
  await page.locator('#prop-name').fill('Approve');
  await page.locator('#prop-name').press('Enter');
  await decisions.nth(1).click();
  await page.locator('#prop-name').fill('Risk score');
  await page.locator('#prop-name').press('Enter');

  const arrow = page.locator('.quick-item.connect');
  const from = (await arrow.boundingBox())!;
  const to = (await decisions.nth(0).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('g.dg-edge')).toHaveCount(1);

  // Sections cannot be deleted.
  await output.click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Delete');
  await expect(output).toHaveCount(1);

  await save(page);
  const xml = await (
    await page.request.get(`${REST}/decision-service-models/${model.id}/dmn`)
  ).text();
  expect(xml).toMatch(/<decision id="[^"]+" name="Approve">[\s\S]*<requiredDecision href="#/);
  expect(xml).toContain('<outputDecision');
  expect(xml).toContain('<encapsulatedDecision');
});
