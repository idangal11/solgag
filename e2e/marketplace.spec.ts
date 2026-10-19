import { expect, test, type Page } from '@playwright/test';
import {
  clickMap,
  deleteTestUsers,
  escapeRegExp,
  expectNoHorizontalScroll,
  loginWithEmailOtp,
  makePng,
  restoreSession,
  saveSession,
  uniqueEmail,
  waitForHydration,
  type Session,
} from './helpers';

/**
 * The full marketplace journey, in order (each project — desktop and mobile — runs it with its own users):
 * a new owner publishes two rooftops (manual area + drawn outline), a new investor runs the calculator,
 * saves a rooftop and sends an inquiry, the owner replies from the dashboard, the investor reads the reply.
 */
test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36);
const OWNER_NAME = 'בעלת גג לבדיקה';
const INVESTOR_NAME = 'משקיע לבדיקה';
const LISTING_PATH = /\/listing\/[0-9a-f-]{36}$/;
/** The manual rooftop: 4,200 m² × 65% = 2,730 usable m² at a requested 18 ₪/m² a year. */
const MANUAL_YEARLY_RENT = 18 * 2730;
/** Stubbed address-search result: an industrial zone in Petah Tikva. */
const PLACE = { label: 'קריית אריה, פתח תקווה', lat: 32.1037, lng: 34.8634 };

let ownerEmail = '';
let investorEmail = '';
let ownerSession: Session;
let investorSession: Session;
let manualTitle = '';
let manualListingPath = '';
let inquiryText = '';
let replyText = '';

async function nextStep(page: Page, stepName: string) {
  await page.getByRole('button', { name: 'הבא', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: new RegExp(`: ${stepName}$`) })).toBeVisible();
}

async function fillOwnerStep(page: Page, title: string, buildingType: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'פרסום גג' })).toBeVisible();
  const ownerName = page.getByLabel(/שם בעלי הגג/);
  await waitForHydration(ownerName);
  await ownerName.fill(OWNER_NAME);
  await page.getByLabel('כותרת המודעה').fill(title);
  // A <select>'s accessible name also contains its chosen option, hence the ^ prefixes.
  await page.getByRole('combobox', { name: /^סוג מבנה/ }).selectOption(buildingType);
  await page.getByRole('combobox', { name: /^אזור/ }).selectOption('center');
  await page.getByLabel('יישוב').fill('פתח תקווה');
  await page.getByLabel('תיאור קצר מהבעלים').fill('גג שטוח וזמין להתקנה. נוצר בבדיקה אוטומטית.');
}

/**
 * Finds the building with the wizard's address search; the map flies there (zoom 18) and drops the marker.
 * Only the external geocoder's answer is stubbed, so runs do not depend on Nominatim/Google.
 */
async function locateBySearch(page: Page) {
  await page.route(/\/api\/geocode\?/, (route) => route.fulfill({ json: [PLACE] }));
  await page.getByRole('searchbox', { name: 'חיפוש כתובת או יישוב' }).fill('קריית אריה פתח תקווה');
  await page.getByRole('button', { name: 'חיפוש', exact: true }).click();
  await page.getByRole('list', { name: 'תוצאות חיפוש' }).getByRole('button', { name: PLACE.label }).click();
  await expect(page.getByText(`נבחר: ${PLACE.label}`)).toBeVisible();
  await expect(page.locator('.draw-map .leaflet-marker-icon[title="מיקום המבנה"]')).toBeVisible();
  await page.waitForTimeout(1500); // the 1 s fly-to animation
}

async function addPhoto(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({ name: 'roof.png', mimeType: 'image/png', buffer: makePng() });
  await expect(page.getByRole('img', { name: 'תמונה חדשה 1' })).toBeVisible();
}

async function declareAndPublish(page: Page, title: string): Promise<string> {
  // Honest default: the listing starts as "ownership not verified".
  await expect(page.getByText(/המודעה תוצג עם התווית/)).toBeVisible();
  await page.getByRole('checkbox', { name: /אני מצהיר\/ה/ }).check();
  await page.getByRole('button', { name: 'פרסום המודעה' }).click();
  await page.waitForURL(LISTING_PATH);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText('המודעה שלך', { exact: true })).toBeVisible();
  await expect(page.getByText('בעלות לא אומתה', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/לא בוצעה בדיקה הנדסית של הגג/).first()).toBeVisible();
  return new URL(page.url()).pathname;
}

test.describe('owner ↔ investor journey', () => {
  test.afterAll(async () => {
    // Removes this run's users, listings and photos when SUPABASE_SERVICE_ROLE_KEY is set.
    await deleteTestUsers([ownerEmail, investorEmail].filter(Boolean));
  });

  test('a new owner publishes a rooftop with a manual area and a photo', async ({ page }, testInfo) => {
    ownerEmail = uniqueEmail('owner', testInfo.project.name);
    manualTitle = `גג מחסן לבדיקה ${RUN} ${testInfo.project.name}`;
    await loginWithEmailOtp(page, ownerEmail, { next: '/publish', name: OWNER_NAME, role: 'owner' });
    ownerSession = await saveSession(page);

    await fillOwnerStep(page, manualTitle, 'warehouse');
    await nextStep(page, 'מיקום וגבולות');

    await locateBySearch(page);
    // Fine-tune the marker by clicking next to it on the map.
    const map = page.getByRole('region', { name: 'מפה לסימון מיקום המבנה' });
    await clickMap(page, map, [[40, 20]]);
    await expect(map.locator('.leaflet-marker-icon[title="מיקום המבנה"]')).toBeVisible();
    await page.getByRole('radio', { name: 'הזנה ידנית' }).click();
    await page.getByLabel(/שטח גג כולל/).fill('4200');
    await page.getByRole('combobox', { name: /^מקור הנתון/ }).selectOption('manual_measured');
    await expect(page.getByText(/שטח שמיש להתקנה: 65%/)).toContainText('2,730');
    await expectNoHorizontalScroll(page);
    await nextStep(page, 'פרטים ותמונות');

    await page.getByLabel('סוג גג', { exact: true }).fill('בטון');
    await addPhoto(page);
    await nextStep(page, 'הסכם ופרסום');

    await page.getByRole('radio', { name: /^שכירות קבועה/ }).check({ force: true });
    await page.getByLabel(/שכירות מבוקשת/).fill('18');
    manualListingPath = await declareAndPublish(page, manualTitle);

    await expect(page.getByRole('img', { name: `תמונה של ${manualTitle}` })).toBeVisible();
    await expect(page.getByText('הוזן ידנית — לפי מדידה / תשריט').first()).toBeVisible();
    // Owner-supplied roof data is labelled as such, not as an engineering assessment.
    await expect(page.getByText('נתונים לפי דיווח הבעלים').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('the owner publishes a second rooftop by drawing its outline on the map', async ({ page }, testInfo) => {
    const title = `גג מפעל משורטט ${RUN} ${testInfo.project.name}`;
    await restoreSession(page, ownerSession);
    await page.goto('/publish');
    await fillOwnerStep(page, title, 'factory');
    await nextStep(page, 'מיקום וגבולות');

    await locateBySearch(page);
    await page.getByRole('radio', { name: 'שרטוט גבולות הגג' }).click();
    const map = page.getByRole('region', { name: 'מפה לשרטוט גבולות הגג' });
    // Corners of a ~60 m × 35 m roof around the marker (zoom 18 ≈ 0.5 m per pixel).
    await clickMap(page, map, [
      [-60, -35],
      [60, -35],
      [60, 35],
      [-60, 35],
    ]);
    await expect(page.getByText('4 נקודות', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'שטח מהשרטוט' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/שטח מחושב \(גיאודזי/)).toBeVisible();
    await expect(page.locator('.area-readout .v')).toHaveText(/\d/);
    await nextStep(page, 'פרטים ותמונות');

    await addPhoto(page);
    await nextStep(page, 'הסכם ופרסום');
    // Keep the default model (revenue share, 12%).
    await expect(page.getByRole('radio', { name: /^חלוקת הכנסות/ })).toBeChecked();
    await declareAndPublish(page, title);

    // The drawn outline is presented as the publisher's sketch, never as a measured boundary.
    await expect(page.getByText('חושב משרטוט גבולות על המפה (PostGIS / Turf.js)').first()).toBeVisible();
    await expect(page.getByText('גבולות הגג שורטטו על ידי המפרסם על גבי המפה, ולא נמדדו או אומתו בשטח.').first()).toBeVisible();
  });

  test('a new investor runs the calculator, saves the rooftop and sends an inquiry', async ({ page }, testInfo) => {
    investorEmail = uniqueEmail('investor', testInfo.project.name);
    inquiryText = `שלום, אני מתעניין בגג לצורך מערכת סולארית (${RUN} ${testInfo.project.name}).`;
    await loginWithEmailOtp(page, investorEmail, { next: manualListingPath, name: INVESTOR_NAME, role: 'investor' });
    investorSession = await saveSession(page);

    await expect(page.getByRole('heading', { level: 1, name: manualTitle })).toBeVisible();
    await expect(page.getByText('המודעה שלך', { exact: true })).toHaveCount(0);

    // Calculator: the worked example 490 kW × 1,650 kWh × 0.30 ₪ = 242,550 ₪ gross.
    const calc = page.getByRole('region', { name: /מחשבון פיננסי פשוט/ });
    await expect(calc).toContainText('לא תחזית, לא ייעוץ ולא הצעת השקעה');
    const capacity = calc.getByLabel('הספק מותקן משוער', { exact: true });
    await waitForHydration(capacity);
    // The rooftop asks for a fixed rent, so the calculator starts in that model: 18 ₪/m² × 2,730 m² = 49,140 ₪ a year.
    await expect(calc.getByRole('radio', { name: 'שכירות קבועה (₪)', exact: true })).toBeChecked();
    await expect(calc.getByLabel('דמי שכירות שנתיים לבעלי הגג', { exact: true })).toHaveValue(String(MANUAL_YEARLY_RENT));
    await expect(calc.getByLabel('חלק בעלי הגג מהתזרים', { exact: true })).toHaveCount(0);
    await expect(calc.locator('.split-col.owner .v')).toContainText(MANUAL_YEARLY_RENT.toLocaleString('en-US'));
    await capacity.fill('490');
    await calc.getByLabel('תפוקה שנתית לכל kW', { exact: true }).fill('1650');
    await calc.getByLabel('מחיר מכירת חשמל', { exact: true }).fill('0.3');
    await expect(calc.locator('.kpi').filter({ hasText: 'הכנסה ברוטו שנתית' })).toContainText('242,550');
    await expect(calc).toContainText('תזרים שנתי לחלוקה');
    await expect(calc.getByText(/^\d+(\.\d)? שנים$/)).toBeVisible(); // simple payback for the investor

    // Favorite
    await page.getByRole('button', { name: 'שמירה למועדפים' }).click();
    await expect(page.getByRole('button', { name: 'שמור במועדפים' })).toHaveAttribute('aria-pressed', 'true');

    // Inquiry
    await page.getByRole('button', { name: /אני מתעניין\/ת/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'מתעניין/ת בגג הזה' })).toBeVisible();
    await dialog.getByLabel('שם מלא').fill(INVESTOR_NAME);
    await dialog.getByLabel(/טלפון או דוא/).fill(investorEmail);
    await dialog.getByRole('combobox', { name: /^אני פונה בתור/ }).selectOption('investor');
    await dialog.getByLabel('הודעה').fill(inquiryText);
    await expectNoHorizontalScroll(page);
    await dialog.getByRole('button', { name: 'שליחת הפנייה' }).click();
    await expect(dialog.getByRole('heading', { name: 'הפנייה נשלחה לבעלי הגג' })).toBeVisible();
    await dialog.getByRole('button', { name: 'חזרה למודעה' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the owner sees the inquiry in the dashboard, opens the thread and replies', async ({ page }, testInfo) => {
    replyText = `תודה על הפנייה! הגג פנוי, נשמח לתאם סיור (${RUN} ${testInfo.project.name}).`;
    await restoreSession(page, ownerSession);
    await page.goto('/dashboard?tab=owner');
    await expect(page.getByRole('heading', { level: 1, name: 'האזור האישי' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /בעלי גג/ })).toHaveAttribute('aria-selected', 'true');

    const received = page.getByRole('region', { name: 'פניות שהתקבלו' });
    const item = received.getByRole('listitem').filter({ hasText: INVESTOR_NAME });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(manualTitle);
    await expect(item.getByRole('combobox', { name: 'עדכון סטטוס' })).toHaveValue('new');
    await expectNoHorizontalScroll(page);

    await item.getByRole('link', { name: /מעבר לשיחה/ }).click();
    await page.waitForURL(/\/inquiries\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: `פנייה מאת ${INVESTOR_NAME}` })).toBeVisible();
    await expect(page.getByText(inquiryText)).toBeVisible();
    await expect(page.getByText(investorEmail).first()).toBeVisible();

    const reply = page.getByLabel('כתיבת תשובה');
    await waitForHydration(reply);
    await reply.fill(replyText);
    await page.getByRole('button', { name: 'שליחה', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: replyText })).toBeVisible();
    // The first reply moves a new inquiry to "in progress".
    await expect(page.getByRole('combobox', { name: 'סטטוס הפנייה' })).toHaveValue('in_progress');
    await expectNoHorizontalScroll(page);
  });

  test('the investor sees the saved rooftop and the owner’s reply', async ({ page }) => {
    await restoreSession(page, investorSession);
    await page.goto('/dashboard?tab=investor');
    await expect(page.getByRole('tab', { name: /משקיע\/ה/ })).toHaveAttribute('aria-selected', 'true');

    const favorites = page.getByRole('region', { name: 'מועדפים', exact: true });
    await expect(favorites.getByRole('article', { name: new RegExp(`^${escapeRegExp(manualTitle)},`) })).toBeVisible();

    const sent = page.getByRole('region', { name: 'פניות ששלחתי' });
    const item = sent.getByRole('listitem').filter({ hasText: manualTitle });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('בטיפול');
    await expectNoHorizontalScroll(page);

    await item.getByRole('link', { name: /מעבר לשיחה/ }).click();
    await page.waitForURL(/\/inquiries\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'הפנייה שלך' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: replyText })).toBeVisible();
    // The sender cannot change the status — only the listing owner sees that control.
    await expect(page.getByRole('combobox', { name: 'סטטוס הפנייה' })).toHaveCount(0);
  });

  test('after signing in again, the saved rooftop is shown as saved straight away', async ({ page }) => {
    // A fresh browser and the in-page code sign-in: favorites must be loaded for the account that just signed in.
    await loginWithEmailOtp(page, investorEmail, { next: manualListingPath });
    await expect(page.getByRole('heading', { level: 1, name: manualTitle })).toBeVisible();
    await expect(page.getByRole('button', { name: 'שמור במועדפים' })).toHaveAttribute('aria-pressed', 'true');
  });
});
