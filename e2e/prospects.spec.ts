import { expect, test } from '@playwright/test';
import { deleteTestUsers, localAdminClient, loginWithEmailOtp, uniqueEmail, waitForHydration } from './helpers';

// Admin-only business-prospect pilot: import → map/list → review → CSV export.
// Needs SUPABASE_SERVICE_ROLE_KEY (local) to grant the test account admin rights.

const admin = localAdminClient();
const RUN = Date.now().toString(36);
const BATCH = `e2e-${RUN}`;

/** widthM × heightM rectangle (GeoJSON [lng, lat]) with its south-west corner at lat/lng. */
function rect(lat: number, lng: number, widthM: number, heightM: number) {
  const dLat = heightM / 110_574;
  const dLng = widthM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { type: 'Polygon', coordinates: [[[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat], [lng, lat]]] };
}

const fixture = {
  batch: BATCH,
  roofs: [
    {
      ref: `E2E-${RUN}-A`,
      sourceKey: `e2e:${RUN}:a`,
      geometry: rect(32.401, 34.894, 80, 50), // ≈ 4,000 m²
      buildingSource: 'Microsoft Global ML Building Footprints',
      buildingLicense: 'CDLA-Permissive-2.0',
      buildingConfidence: 'high',
      buildingBasis: ['test fixture'],
      address: { street: 'המסיק', houseNumber: '6', locality: 'פארק תעשיות עמק חפר', source: 'OpenStreetMap way/1', sourceUrl: 'https://www.openstreetmap.org/way/1', method: 'test', confidence: 'high' },
      suitability: { usableAreaM2: 2600, estKwpDc: 400, assumptions: 'test' },
      businesses: [
        {
          dedupeKey: 'acme',
          name: `מפעל בדיקה ${RUN}`,
          matchConfidence: 'medium',
          matchBasis: 'נקודת עסק בתוך טביעת הרגל',
          phone: '04-6000000',
          phoneSourceUrl: 'https://example.com/contact',
          sources: [{ url: 'https://example.com/contact', kind: 'official', label: 'צור קשר' }],
        },
      ],
    },
    {
      ref: `E2E-${RUN}-B`,
      sourceKey: `e2e:${RUN}:b`,
      isDemo: true,
      geometry: rect(32.403, 34.896, 40, 40), // ≈ 1,600 m²
      buildingSource: 'test',
      buildingLicense: 'CDLA-Permissive-2.0',
      buildingConfidence: 'low',
    },
  ],
};

test.describe('admin: business-prospect pilot', () => {
  test.skip(!admin, 'needs SUPABASE_SERVICE_ROLE_KEY for the local stack');
  const emails: string[] = [];

  test.afterAll(async () => {
    await admin?.from('prospect_roofs').delete().eq('batch', BATCH);
    await deleteTestUsers(emails);
  });

  test('import, filter, review and export', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for this admin flow');
    const email = uniqueEmail('prospect-admin', testInfo.project.name);
    emails.push(email);
    await loginWithEmailOtp(page, email, { name: 'מנהלת בדיקה', role: 'investor' });

    // Not an admin yet: the area does not exist for them, and the export is refused.
    expect((await page.goto('/admin/prospects'))?.status()).toBe(404);
    expect((await page.request.get('/admin/prospects/export')).status()).toBe(404);

    const { data: users } = await admin!.auth.admin.listUsers({ perPage: 1000 });
    const id = users.users.find((u) => u.email === email)?.id;
    expect(id).toBeTruthy();
    await admin!.from('profiles').update({ is_admin: true }).eq('id', id!);

    await page.goto('/admin/prospects');
    await expect(page.getByRole('heading', { level: 1, name: /גגות פוטנציאליים/ })).toBeVisible();

    // Import the fixture through the real upload form.
    await page.getByText('ייבוא אצווה ממחקר', { exact: true }).click();
    const file = page.getByLabel('קובץ ייבוא');
    await waitForHydration(file);
    await file.setInputFiles({ name: 'prospects-import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.getByRole('button', { name: 'ייבוא', exact: true }).click();
    await expect(page.getByText(/יובאו 2 גגות ו-1 התאמות עסקים/)).toBeVisible();

    const rowA = page.getByRole('button', { name: `E2E-${RUN}-A` });
    const rowB = page.getByRole('button', { name: `E2E-${RUN}-B` });
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    // Minimum-area filter (the URL keeps it).
    await page.getByLabel('שטח מינימלי (מ״ר)').fill('3000');
    await expect(rowB).toBeHidden();
    await expect(page).toHaveURL(/minArea=3000/);
    await page.getByLabel('שטח מינימלי (מ״ר)').fill('');
    await expect(rowB).toBeVisible();

    // Demo rows are labelled as such.
    await rowB.click();
    await expect(page.getByText('נתוני הדגמה — לא אמיתי')).toBeVisible();

    // Details: separate confidences, tenant-safe relation, sourced phone, missing e-mail shown as unavailable.
    await rowA.click();
    const detail = page.locator('.pr-detail');
    await expect(detail.getByRole('heading', { name: `E2E-${RUN}-A` })).toBeVisible();
    await expect(detail.getByText('רשומה אמיתית')).toBeVisible();
    await expect(detail.getByText('התאמת עסק לגג: בינונית')).toBeVisible();
    await expect(detail.getByText('עסק בכתובת — לא ידוע אם בעלים')).toBeVisible();
    await expect(detail.getByText('04-6000000')).toBeVisible();
    await expect(detail.locator('.pr-contact').filter({ hasText: 'דוא״ל עסקי' }).getByText('לא זמין')).toBeVisible();

    // Approve the business match, then the roof.
    await detail.getByRole('button', { name: /אישור התאמה/ }).click();
    await expect(page.getByText('ההתאמה אושרה')).toBeVisible();
    await expect(detail.locator('.pr-biz').getByText('אושר', { exact: true })).toBeVisible();
    await detail.getByRole('button', { name: 'אישור הגג' }).click();
    await expect(detail.locator('.pr-detail-head').getByText('אושר', { exact: true })).toBeVisible();

    // A correction cannot add a contact detail without its source.
    await detail.getByRole('button', { name: /^תיקון — מפעל בדיקה/ }).click();
    await detail.getByLabel('דוא״ל עסקי', { exact: true }).fill('info@example.com');
    await detail.getByRole('button', { name: 'שמירת תיקון' }).click();
    await expect(page.getByText(/לדוא״ל חייב להיות קישור למקור/)).toBeVisible();

    // CSV export with the current filters.
    const csv = await page.request.get('/admin/prospects/export?review=approved');
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    const text = await csv.text();
    expect(text).toContain(`E2E-${RUN}-A`);
    expect(text).not.toContain(`E2E-${RUN}-B`);
    expect(text).toContain('04-6000000');
    expect(text).toContain('לא ידוע אם בעלים');
  });
});
