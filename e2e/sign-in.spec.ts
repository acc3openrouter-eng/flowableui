import { USER, expect, signIn, test } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('sends signed-out visitors to the sign-in page and back', async ({ page }) => {
  await page.goto('/#/forms');
  await expect(page).toHaveURL(/#\/login/);
  await page.locator('input[name=username]').fill(USER.name);
  await page.locator('p-password input').fill(USER.password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/#\/forms/);
});

test('refuses a wrong password', async ({ page }) => {
  await page.goto('/#/login');
  await page.locator('input[name=username]').fill(USER.name);
  await page.locator('p-password input').fill('not-the-password');
  await page.locator('button[type=submit]').click();
  await expect(page.locator('p-message')).toBeVisible();
  await expect(page).toHaveURL(/#\/login/);
});

test('signs in', async ({ page }) => {
  await signIn(page, USER.name, USER.password);
  await expect(page.getByRole('navigation', { name: 'Model types' })).toBeVisible();
});
