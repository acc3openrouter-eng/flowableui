import { REST, expect, save, test } from './fixtures';

test('docks a criterion, links it to a task and exports the sentry', async ({ page, models }) => {
  const model = await models.create('case');
  await page.goto(`/#/case-editor/${model.id}`);
  const plan = page.locator('g.dg-node[data-stencil=CasePlanModel]');
  await expect(plan).toBeVisible();
  // Expand every palette group so all stencils can be dragged.
  for (const head of await page.locator('.group-head').all()) {
    if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
  }
  const canvas = page.locator('fm-diagram-canvas .scroller');
  const planBox = (await plan.boundingBox())!;
  const canvasBox = (await canvas.boundingBox())!;
  const drop = (stencil: string, x: number, y: number) =>
    page
      .locator(`.stencil[data-stencil=${stencil}]`)
      .dragTo(canvas, { targetPosition: { x: x - canvasBox.x, y: y - canvasBox.y } });

  await drop('HumanTask', planBox.x + 120, planBox.y + 120);
  await drop('HumanTask', planBox.x + 400, planBox.y + 120);
  const tasks = page.locator('g.dg-node[data-stencil=HumanTask]');
  await expect(tasks).toHaveCount(2);
  const ids = await tasks.evaluateAll((els) =>
    els
      .map((e) => ({ id: e.getAttribute('data-id')!, x: e.getBoundingClientRect().x }))
      .sort((a, b) => a.x - b.x)
      .map((e) => e.id),
  );
  const first = page.locator(`g.dg-node[data-id="${ids[0]}"]`);
  const second = page.locator(`g.dg-node[data-id="${ids[1]}"]`);
  await first.click();
  await page.locator('#prop-name').fill('Review');
  await page.locator('#prop-name').press('Enter');
  await second.click();
  await page.locator('#prop-name').fill('Approve');
  await page.locator('#prop-name').press('Enter');

  // Dropped on the left border of "Approve", the entry criterion docks there.
  const target = (await second.boundingBox())!;
  await drop('EntryCriterion', target.x + 1, target.y + target.height / 2);
  const criterion = page.locator('g.dg-node[data-stencil=EntryCriterion]');
  await expect(criterion).toHaveCount(1);

  // Connect "Review" to the criterion with the quick menu's arrow.
  await first.click();
  const arrow = page.locator('.quick-item.connect');
  await expect(arrow).toBeVisible();
  const from = (await arrow.boundingBox())!;
  const to = (await criterion.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('g.dg-edge')).toHaveCount(1);

  // The plan model stays.
  await plan.click({ position: { x: planBox.width - 20, y: planBox.height - 20 } });
  await page.keyboard.press('Delete');
  await expect(plan).toHaveCount(1);

  await save(page);
  const xml = await (await page.request.get(`${REST}/models/${model.id}/cmmn`)).text();
  expect(xml).toMatch(/<planItem id="(planItem\d+)" name="Review"/);
  const source = /<planItem id="(planItem\d+)" name="Review"/.exec(xml)![1];
  expect(xml).toContain(`<planItemOnPart id="sentryOnPart1" sourceRef="${source}">`);
  expect(xml).toMatch(/<planItem id="planItem\d+" name="Approve"[^>]*>\s*<entryCriterion/);
});
