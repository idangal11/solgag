import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, FICTIONAL_RIBBON, SEED_TITLES, waitForHydration } from './helpers';

// The explore page as an anonymous visitor. Requires the demo seed (npx supabase db reset).

const SAMPLE = 'בית אריזה חקלאי'; // the only seeded listing in the "ערבה ואילת" region

test.describe('explore map (anonymous)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: 'מפת גגות לסולארי' });
    await expect(heading).toBeVisible();
    await waitForHydration(heading);
  });

  test('shows the map and the 12 fictional demo listings, clearly labelled', async ({ page, isMobile }) => {
    const list = page.getByRole('complementary', { name: 'רשימת גגות' });
    await expect(list.getByRole('article').filter({ hasText: FICTIONAL_RIBBON })).toHaveCount(SEED_TITLES.length);
    for (const title of SEED_TITLES) {
      await expect(list.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(list.getByText(/12 מהם מודעות לדוגמה \(בדויות\)/)).toBeVisible();
    await expectNoHorizontalScroll(page);

    if (isMobile) await page.getByRole('button', { name: 'מפה', exact: true }).click();
    const map = page.getByRole('region', { name: 'מפת גגות' });
    await expect(map.locator('.leaflet-container')).toBeVisible();
    // Every rooftop has a pin; the demo ones say they are fictional.
    await expect.poll(() => map.locator('.leaflet-marker-icon').count()).toBeGreaterThanOrEqual(SEED_TITLES.length);
    await expect(map.locator(`.leaflet-marker-icon[title*="${FICTIONAL_RIBBON}"]`)).toHaveCount(SEED_TITLES.length);
    await expectNoHorizontalScroll(page);
  });

  test('filters narrow the results and can be cleared', async ({ page }) => {
    const list = page.getByRole('complementary', { name: 'רשימת גגות' });
    const cards = list.getByRole('article');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();

    // On mobile the filters are collapsed behind a toggle.
    const toggle = page.getByRole('button', { name: /^סינון/ });
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }

    // A <select>'s accessible name also contains its chosen option ("אזור כל הארץ").
    await page.getByRole('combobox', { name: /^אזור/ }).selectOption('arava');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText(SAMPLE);
    await expect(list.getByText(/^מוצגים 1 מתוך/)).toBeVisible();
    await expect(page).toHaveURL(/[?&]region=arava/);

    // A fictional listing is never "open to inquiries".
    await page.getByLabel('רק גגות שפתוחים לפניות').check();
    await expect(cards).toHaveCount(0);
    await expect(list.getByText('אין גגות שתואמים לסינון.')).toBeVisible();

    await list.getByRole('button', { name: 'נקה סינון', exact: true }).click();
    await expect(cards).toHaveCount(total);
    await expect(page).not.toHaveURL(/region=/);
    await expectNoHorizontalScroll(page);
  });

  test('focusing a card opens its preview on the map, with an honest boundary note', async ({ page, isMobile }) => {
    const card = page.getByRole('article', { name: new RegExp(`^${SAMPLE},`) });
    await card.getByRole('button', { name: 'הצג במפה' }).click();

    const preview = page.getByRole('region', { name: `תצוגה מקדימה: ${SAMPLE}` });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(FICTIONAL_RIBBON);
    await expect(preview).toContainText('הגבול המסומן להמחשה בלבד ואינו גבול מדוד של המבנה.');
    await expect(preview.getByRole('link', { name: 'פתח מודעה מלאה' })).toHaveAttribute('href', /^\/listing\/[0-9a-f-]{36}$/);
    await expect(page).toHaveURL(/[?&]focus=[0-9a-f-]{36}/);
    if (isMobile) await expect(page.getByRole('button', { name: 'מפה', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await preview.getByRole('button', { name: 'סגירת התצוגה המקדימה' }).click();
    await expect(preview).toBeHidden();
    await expect(page).not.toHaveURL(/focus=/);
  });

  test('mobile: switches between the list and the map', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the list/map toggle exists only on small screens');
    const listButton = page.getByRole('button', { name: 'רשימה', exact: true });
    const mapButton = page.getByRole('button', { name: 'מפה', exact: true });
    const side = page.locator('aside.explore-side');
    const map = page.locator('section.explore-map');

    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expect(side).toBeVisible();
    await expect(map).toBeHidden();

    await mapButton.click();
    await expect(mapButton).toHaveAttribute('aria-pressed', 'true');
    await expect(map.locator('.leaflet-container')).toBeVisible();
    await expect(side).toBeHidden();
    await expectNoHorizontalScroll(page);

    await listButton.click();
    await expect(listButton).toHaveAttribute('aria-pressed', 'true');
    await expect(side).toBeVisible();
    await expect(map).toBeHidden();
    await expectNoHorizontalScroll(page);
  });

  test('saving a favorite while signed out leads to the login page', async ({ page }) => {
    const favorite = page.getByRole('button', { name: 'שמור למועדפים' }).first();
    await waitForHydration(favorite);
    await favorite.click();
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(page.getByRole('heading', { level: 1, name: 'כניסה לסולגג' })).toBeVisible();
  });
});
