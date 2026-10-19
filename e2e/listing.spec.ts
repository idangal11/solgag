import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  FICTIONAL_RIBBON,
  FIXED_RENT_SAMPLE,
  OPEN_STATUS_LABEL,
  SAMPLE_STATUS_LABEL,
  waitForHydration,
} from './helpers';

// Listing page and protected routes as an anonymous visitor. Requires the demo seed.

const SAMPLE = 'בית אריזה חקלאי'; // fictional, revenue share 12%

async function openListing(page: Page, title: string) {
  await page.goto('/');
  await page
    .getByRole('article', { name: new RegExp(`^${title},`) })
    .getByRole('link', { name: 'לפרטים ולחישוב' })
    .click();
  await expect(page).toHaveURL(/\/listing\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await waitForHydration(page.getByRole('button', { name: 'איפוס הנחות' }));
}

/** The calculator and its payment-model switch (the radios are visually hidden inside their labels). */
function calculator(page: Page) {
  const calc = page.getByRole('region', { name: /מחשבון פיננסי פשוט/ });
  const model = calc.getByRole('group', { name: 'מודל התשלום לבעלי הגג' });
  return {
    calc,
    shareMode: model.getByRole('radio', { name: 'חלוקת הכנסות (%)', exact: true }),
    rentMode: model.getByRole('radio', { name: 'שכירות קבועה (₪)', exact: true }),
    shareField: calc.getByLabel('חלק בעלי הגג מהתזרים', { exact: true }),
    rentField: calc.getByLabel('דמי שכירות שנתיים לבעלי הגג', { exact: true }),
    ownerCol: calc.locator('.split-col.owner'),
    investorCol: calc.locator('.split-col.investor'),
  };
}

/** Clicks the visible label around a visually hidden radio (a forced click could hit the mobile action bar). */
const choose = async (radio: Locator) => {
  await radio.locator('xpath=..').click();
  await expect(radio).toBeChecked();
};

test.describe('listing page (anonymous)', () => {
  test('a fictional listing is labelled as such and cannot receive inquiries', async ({ page, isMobile }) => {
    await openListing(page, SAMPLE);

    await expect(page.getByText('מודעה לדוגמה — בדויה. אין מאחוריה מבנה או בעלים אמיתיים, והיא אינה פתוחה לפניות.')).toBeVisible();
    await expect(page.getByText(FICTIONAL_RIBBON, { exact: true }).first()).toBeVisible();
    // Its status is "sample listing", never an availability such as "open to inquiries".
    const head = page.locator('.detail-head');
    await expect(head.locator('.badge.status')).toHaveText(SAMPLE_STATUS_LABEL);
    await expect(head).not.toContainText(OPEN_STATUS_LABEL);
    // ...and no availability description that would suggest the owner wants inquiries.
    await expect(head.locator('.status-desc')).not.toContainText('הבעלים מבקשים לקבל פניות ממשקיעים');
    await expect(head.locator('.status-desc')).toContainText('מודעה לדוגמה');
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
    await openListing(page, SAMPLE);
    const { calc } = calculator(page);
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

  test('a revenue-share listing starts the calculator in the share model; the model can be switched', async ({ page }) => {
    await openListing(page, SAMPLE);
    const { calc, shareMode, rentMode, shareField, rentField, ownerCol, investorCol } = calculator(page);

    await expect(shareMode).toBeChecked();
    await expect(rentMode).not.toBeChecked();
    await expect(shareField).toHaveValue('12'); // the listing's own share
    await expect(rentField).toHaveCount(0);
    await expect(ownerCol).not.toContainText('שכירות קבועה');

    await choose(rentMode);
    await expect(rentMode).toBeChecked();
    await expect(rentField).toBeVisible();
    await expect(shareField).toHaveCount(0);
    await expect(ownerCol).toContainText('לבעלי הגג (שכירות קבועה)');
    await expect(investorCol).toContainText('למשקיע (יתרת התזרים)');

    await rentField.fill('50000');
    await expect(ownerCol.locator('.v')).toContainText('50,000');

    // Reset returns to the listing's own model and numbers.
    await calc.getByRole('button', { name: 'איפוס הנחות' }).click();
    await expect(shareMode).toBeChecked();
    await expect(shareField).toHaveValue('12');
  });

  test('a fixed-rent listing starts the calculator in the fixed-rent model with the requested rent', async ({ page }) => {
    await openListing(page, FIXED_RENT_SAMPLE.title);
    await expect(page.locator('.detail-head .badge.status')).toHaveText(SAMPLE_STATUS_LABEL);
    await expect(page.locator('.detail-head .agreement-chip')).toHaveText('שכירות קבועה');

    const { calc, shareMode, rentMode, shareField, rentField, ownerCol, investorCol } = calculator(page);
    const rent = String(FIXED_RENT_SAMPLE.yearlyRent);
    const rentShown = FIXED_RENT_SAMPLE.yearlyRent.toLocaleString('en-US'); // "73,980"

    await expect(rentMode).toBeChecked();
    await expect(shareMode).not.toBeChecked();
    await expect(rentField).toHaveValue(rent); // 18 ₪/m² × 4,110 usable m²
    await expect(shareField).toHaveCount(0);
    await expect(ownerCol).toContainText('לבעלי הגג (שכירות קבועה)');
    await expect(ownerCol.locator('.v')).toContainText(rentShown);
    await expect(investorCol).toContainText('למשקיע (יתרת התזרים)');

    // Switching models keeps the numbers of the other one.
    await choose(shareMode);
    await expect(shareField).toHaveValue('12'); // the default share — the listing asks for rent, not a share
    await expect(rentField).toHaveCount(0);
    await expect(ownerCol).not.toContainText('שכירות קבועה');
    await choose(rentMode);
    await expect(rentField).toHaveValue(rent);

    // The rent is owed even when the cash flow does not cover it: the investor carries the difference.
    await calc.getByLabel('הוצאות תפעול שנתיות', { exact: true }).fill('300000');
    await expect(ownerCol.locator('.v')).toContainText(rentShown);
    await expect(calc.getByText('אין החזר בתרחיש זה', { exact: true })).toBeVisible();
    await expect(calc.getByText('השכירות גבוהה מהתזרים לחלוקה בתרחיש זה — המשקיע מממן את ההפרש.')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('saving a favorite while signed out leads to the login page and back', async ({ page }) => {
    await openListing(page, SAMPLE);
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
