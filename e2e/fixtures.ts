import { Page, expect, test as base } from '@playwright/test';

export const REST = '/flowable-ui/modeler-app/rest';
export const USER = {
  name: process.env['E2E_USER'] ?? 'admin',
  password: process.env['E2E_PASSWORD'] ?? 'test',
};

/** Flowable model types (`modelType` in the REST API). */
export const MODEL_TYPES = {
  process: 0,
  form: 2,
  app: 3,
  decisionTable: 4,
  case: 5,
  decisionService: 6,
} as const;
export type ModelKind = keyof typeof MODEL_TYPES;

export interface CreatedModel {
  id: string;
  name: string;
  key: string;
}

export async function signIn(page: Page, user: string, password: string) {
  await page.goto('/#/login');
  await page.locator('input[name=username]').fill(user);
  await page.locator('p-password input').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/#\/processes/);
}

let counter = 0;
/** A unique suffix, so runs never collide on model keys. */
export const unique = () =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

interface Fixtures {
  /** Creates models through the REST API and deletes them after the test. */
  models: {
    create(kind: ModelKind, name?: string): Promise<CreatedModel>;
    /** Deletes a model created some other way (for example through the UI) after the test. */
    track(id: string): void;
  };
}

export const test = base.extend<Fixtures>({
  models: async ({ page }, use) => {
    const ids: string[] = [];
    await use({
      async create(kind, name) {
        const suffix = unique();
        const response = await page.request.post(`${REST}/models`, {
          data: {
            name: name ?? `e2e ${kind} ${suffix}`,
            key: `e2e_${kind}_${suffix}`,
            description: '',
            modelType: MODEL_TYPES[kind],
          },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        const model = (await response.json()) as CreatedModel;
        ids.push(model.id);
        return model;
      },
      track(id) {
        ids.push(id);
      },
    });
    for (const id of ids.reverse()) await page.request.delete(`${REST}/models/${id}?cascade=true`);
  },
});

export { expect };

/** Opens the save dialog of an editor and saves without a new version. */
export async function save(page: Page) {
  await page.keyboard.press('Control+s');
  const dialog = page.getByRole('dialog').filter({ has: page.locator('#fs-name') });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.unsaved')).toHaveCount(0);
}
