import { expect, test, type Page } from '@playwright/test';
import { deleteTestUsers, localAdminClient, uniqueEmail } from './helpers';

/**
 * /auth/callback accepts only PKCE `?code=` links, which work only in the browser that asked for them.
 * `?token_hash=` links are refused: they would sign in whoever opens them (login CSRF / session fixation).
 */

const LINK_ERROR = 'הקישור שנפתח אינו תקף או שפג תוקפו';

async function expectSignedOut(page: Page) {
  const authCookies = (await page.context().cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name));
  expect(authCookies, 'no Supabase session cookie was set').toEqual([]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
}

test.describe('sign-in links (/auth/callback)', () => {
  const created: string[] = [];
  test.afterAll(async () => deleteTestUsers(created));

  test('a token_hash link is refused and signs nobody in', async ({ page }, testInfo) => {
    // With SUPABASE_SERVICE_ROLE_KEY: a REAL, unused magic-link token of an existing account.
    // Without it: a well-formed made-up one (still proves the route never signs in from it).
    let tokenHash = 'a1b2c3d4'.repeat(7);
    const admin = localAdminClient();
    if (admin) {
      const email = uniqueEmail('linkvictim', testInfo.project.name);
      created.push(email);
      const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
      expect(createError?.message ?? null).toBeNull();
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      expect(error?.message ?? null).toBeNull();
      expect(data.properties?.hashed_token).toBeTruthy();
      tokenHash = data.properties!.hashed_token;
    }

    for (const type of ['magiclink', 'email', 'signup']) {
      await page.goto(`/auth/callback?token_hash=${tokenHash}&type=${type}&next=%2Fdashboard`);
      await expect(page).toHaveURL(/\/login\?error=1&next=%2Fdashboard$/);
      await expect(page.getByRole('alert').filter({ hasText: LINK_ERROR })).toBeVisible();
    }
    await expectSignedOut(page);
  });

  test('a code link this browser did not start is refused', async ({ page }) => {
    await page.goto('/auth/callback?code=3f9a1c2e-0000-4000-8000-000000000000&next=%2Fpublish');
    await expect(page).toHaveURL(/\/login\?error=1&next=%2Fpublish$/);
    await expect(page.getByRole('alert').filter({ hasText: LINK_ERROR })).toBeVisible();
    await expectSignedOut(page);
  });
});
