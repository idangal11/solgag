import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, FICTIONAL_RIBBON, waitForHydration } from './helpers';

// Listing page and protected routes as an anonymous visitor. Requires the demo seed.

const SAMPLE = 'בית אריזה חקלאי';

async function openSampleListing(page: Page) {
  await page.goto('/');
  await page
    .getByRole('article', { name: new RegExp(`^${SAMPLE},`) })
    .getByRole('link', { name: 'לפרטים ולחישוב' })
    .click();
  await expect(page).toHaveURL(/\/listing\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: SAMPLE })).toBeVisible();
  await waitForHydration(page.getByRole('button', { name: 'איפוס הנחות' }));
}

test.describe('listing page (anonymous)', () => {
  test('a fictional listing is labelled as such and cannot receive inquiries', async ({ page, isMobile }) => {
    await openSampleListing(page);

    await expect(page.getByText('מודעה לדוגמה — בדויה. אין מאחוריה מבנה או בעלים אמיתיים, והיא אינה פתוחה לפניות.')).toBeVisible();
    await expect(page.getByText(FICTIONAL_RIBBON, { exact: true }).first()).toBeVisible();
    // Never implies a verification or an engineering survey that did not happen.
    await expect(page.getByText('בעלות לא אומתה', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('בעלות נבדקה מול מסמכים')).toHaveCount(0);
    await expect(page.getByText('מיקום ופוליגון להמחשה בלבד. הם אינם מייצגים את גבולות מבנה אמיתי כלשהו.')).toBeVisible();

    // Desktop: the button in the side card plus an explanation; mobile: the bottom action bar.
    const inquire = isMobile
      ? page.getByRole('button', { name: 'מודעה לדוגמה — אין פניות' })
      : page.getByRole('button', { name: /אני מתעניין\/ת בגג הזה/ });
    await expect(inquire).toBeVisible();
    await expect(inquire).toBeDisabled();
    if (!isMobile) await expect(page.getByText('מודעה לדוגמה — לא ניתן לשלוח פנייה')).toBeVisible();
    await inquire.click({ force: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expectNoHorizontalScroll(page);
  });

  test('the calculator keeps its disclaimers and never promises a payback', async ({ page }) => {
    await openSampleListing(page);
    const calc = page.getByRole('region', { name: /מחשבון פיננסי פשוט/ });
    await expect(calc).toContainText('כל המספרים הם הנחות להמחשה שניתן לערוך — לא תחזית, לא ייעוץ ולא הצעת השקעה.');
    await expect(calc).toContainText('תזרים שנתי לחלוקה');

    // The payback figure itself (the phrase also appears in the "how is it calculated" notes).
    const noPayback = calc.getByText('אין החזר בתרחיש זה', { exact: true });
    const payback = calc.getByText(/^\d+(\.\d)? שנים$/);
    await expect(payback).toBeVisible();

    await calc.getByLabel('הוצאות תפעול שנתיות', { exact: true }).fill('10000000');
    await expect(noPayback).toBeVisible();
    await expect(payback).toHaveCount(0);
    // Negative cash flow: the roof owner's share is ₪0 (the investor carries the shortfall).
    await expect(calc.locator('.split-col.owner .v')).toHaveText(/^\D*0\D*$/);

    await calc.getByRole('button', { name: 'איפוס הנחות' }).click();
    await expect(noPayback).toHaveCount(0);
    await expect(payback).toBeVisible();
  });

  test('saving a favorite while signed out leads to the login page and back', async ({ page }) => {
    await openSampleListing(page);
    const listingPath = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'שמירה למועדפים' }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(listingPath)}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'כניסה לסולגג' })).toBeVisible();
  });

  test('protected pages send anonymous visitors to the login page', async ({ page }) => {
    for (const path of ['/publish', '/dashboard', '/account']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
      await expect(page.getByRole('heading', { level: 1, name: 'כניסה לסולגג' })).toBeVisible();
    }
  });
});
