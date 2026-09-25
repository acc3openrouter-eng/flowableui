import { test as setup } from '@playwright/test';
import { USER, signIn } from './fixtures';

setup('sign in', async ({ page }) => {
  await signIn(page, USER.name, USER.password);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
