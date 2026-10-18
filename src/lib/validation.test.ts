import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { contactSchema, fieldErrors, inquirySchema, listingSchema, messageSchema } from './validation';

const LISTING_ID = '3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f';

const isHebrew = (s: string) => /[֐-׿]/.test(s);

/** Errors of a failed parse, keyed by field path. */
function errorsOf(r: { success: boolean; error?: ZodError }): Record<string, string> {
  if (r.success || !r.error) throw new Error('expected the parse to fail');
  return fieldErrors(r.error);
}

describe('inquirySchema', () => {
  const valid = {
    listingId: LISTING_ID,
    senderName: 'דנה כהן',
    senderContact: 'dana@example.com',
    senderRole: 'investor',
    message: 'שלום, אשמח לפרטים על הגג.',
  };

  it('accepts a complete inquiry and trims text fields', () => {
    const r = inquirySchema.safeParse({ ...valid, senderName: '  דנה כהן  ', message: '  שלום, אשמח לפרטים.  ' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ senderName: 'דנה כהן', message: 'שלום, אשמח לפרטים.' });
  });

  it.each(['050-1234567', '0501234567', '+972 50 123 4567', '+972501234567', 'dana@example.com', 'a.b+tag@sub.example.co.il'])(
    'accepts the contact %s',
    (contact) => {
      expect(inquirySchema.safeParse({ ...valid, senderContact: contact }).success).toBe(true);
    },
  );

  it.each(['', 'abc', '12345', '050-12', 'dana@example', 'dana example.com', 'דנה@דוגמה'])('rejects the contact "%s" in Hebrew', (contact) => {
    const errors = errorsOf(inquirySchema.safeParse({ ...valid, senderContact: contact }));
    expect(errors.senderContact).toBe('נא להזין טלפון או דוא״ל תקינים');
  });

  it('requires a name and a short message', () => {
    const errors = errorsOf(inquirySchema.safeParse({ ...valid, senderName: '  ', message: 'היי' }));
    expect(errors.senderName).toBe('נא להזין שם');
    expect(errors.message).toBe('נא לכתוב הודעה קצרה');
  });

  it('limits message length', () => {
    const errors = errorsOf(inquirySchema.safeParse({ ...valid, message: 'א'.repeat(2001) }));
    expect(errors.message).toBe('עד 2000 תווים');
  });

  it('rejects an unknown role and a malformed listing id', () => {
    const errors = errorsOf(inquirySchema.safeParse({ ...valid, senderRole: 'broker', listingId: 'not-a-uuid' }));
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['senderRole', 'listingId']));
  });
});

describe('contactSchema', () => {
  it('trims before validating', () => {
    expect(contactSchema.parse('  050-1234567 ')).toBe('050-1234567');
  });
});

describe('messageSchema', () => {
  it('rejects an empty reply in Hebrew', () => {
    const errors = errorsOf(messageSchema.safeParse({ inquiryId: LISTING_ID, body: '   ' }));
    expect(errors.body).toBe('ההודעה ריקה');
  });

  it('accepts a one-character reply', () => {
    expect(messageSchema.safeParse({ inquiryId: LISTING_ID, body: 'כן' }).success).toBe(true);
  });
});

describe('listingSchema', () => {
  const SQUARE: [number, number][] = [
    [32.09, 34.88],
    [32.09, 34.8806],
    [32.0905, 34.8806],
    [32.0905, 34.88],
  ];

  const base = {
    ownerDisplayName: 'ישראל ישראלי',
    title: 'גג מחסן גדול',
    buildingType: 'warehouse',
    region: 'center',
    locality: 'פתח תקווה',
    description: '',
    location: [32.09025, 34.8803],
    polygon: SQUARE,
    areaSource: 'polygon',
    totalAreaSqm: 3100,
    usableAreaSqm: 2000,
    roofType: '',
    shading: '',
    grid: '',
    roofAgeYears: null,
    agreement: 'open',
    rentPerSqmYear: null,
    sharePct: null,
    termYears: 20,
    termsNotes: '',
    availability: 'available',
    declared: true,
  };

  it('accepts a complete polygon listing and turns empty optional text into null', () => {
    const r = listingSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ roofType: null, shading: null, grid: null });
  });

  it('accepts a manual area without any polygon', () => {
    expect(listingSchema.safeParse({ ...base, polygon: [], areaSource: 'manual_measured' }).success).toBe(true);
    expect(listingSchema.safeParse({ ...base, polygon: [], areaSource: 'manual_estimate' }).success).toBe(true);
  });

  it('requires at least 3 points when the area comes from the polygon', () => {
    const errors = errorsOf(listingSchema.safeParse({ ...base, polygon: SQUARE.slice(0, 2) }));
    expect(errors.polygon).toBe('נא לשרטט לפחות 3 נקודות, או לעבור להזנת שטח ידנית');
    expect(errorsOf(listingSchema.safeParse({ ...base, polygon: [] })).polygon).toBeDefined();
  });

  it('rejects a usable area larger than the total area', () => {
    const errors = errorsOf(listingSchema.safeParse({ ...base, usableAreaSqm: 3200 }));
    expect(errors.usableAreaSqm).toBe('השטח השמיש גדול מהשטח הכולל');
    expect(listingSchema.safeParse({ ...base, usableAreaSqm: 3100 }).success).toBe(true);
  });

  it('requires a positive rent for the fixed-rent model', () => {
    expect(errorsOf(listingSchema.safeParse({ ...base, agreement: 'fixed_rent' })).rentPerSqmYear).toBe('נא להזין שכירות מבוקשת');
    expect(errorsOf(listingSchema.safeParse({ ...base, agreement: 'fixed_rent', rentPerSqmYear: 0 })).rentPerSqmYear).toBe(
      'נא להזין שכירות מבוקשת',
    );
    expect(listingSchema.safeParse({ ...base, agreement: 'fixed_rent', rentPerSqmYear: 18 }).success).toBe(true);
  });

  it('requires an owner share for the revenue-share model, strictly between 0 and 100', () => {
    expect(errorsOf(listingSchema.safeParse({ ...base, agreement: 'revenue_share' })).sharePct).toBe('נא להזין אחוז בין 1 ל-99');
    expect(listingSchema.safeParse({ ...base, agreement: 'revenue_share', sharePct: 14 }).success).toBe(true);
    expect(listingSchema.safeParse({ ...base, agreement: 'revenue_share', sharePct: 100 }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, agreement: 'revenue_share', sharePct: 0 }).success).toBe(false);
  });

  it('needs neither rent nor share for "open to offers"', () => {
    expect(listingSchema.safeParse({ ...base, agreement: 'open', rentPerSqmYear: null, sharePct: null }).success).toBe(true);
  });

  it('refuses to publish without the ownership declaration', () => {
    const errors = errorsOf(listingSchema.safeParse({ ...base, declared: false }));
    expect(errors.declared).toBe('יש לאשר את ההצהרה כדי לפרסם');
    expect(listingSchema.safeParse({ ...base, declared: undefined }).success).toBe(false);
  });

  it('rejects areas below a commercial roof and above the supported maximum, in Hebrew', () => {
    expect(errorsOf(listingSchema.safeParse({ ...base, totalAreaSqm: 40, usableAreaSqm: 30 })).totalAreaSqm).toMatch(/קטן מדי/);
    expect(errorsOf(listingSchema.safeParse({ ...base, totalAreaSqm: 600_000 })).totalAreaSqm).toBe('שטח גדול מדי');
  });

  it('rejects locations and polygon points outside the supported area', () => {
    expect(errorsOf(listingSchema.safeParse({ ...base, location: [40.7, -74] }))).toHaveProperty(['location.0']);
    expect(Object.keys(errorsOf(listingSchema.safeParse({ ...base, polygon: [...SQUARE, [34, 34.9]] })))[0]).toMatch(/^polygon\./);
  });

  it('validates the remaining field ranges', () => {
    const errors = errorsOf(
      listingSchema.safeParse({ ...base, title: 'גג', roofAgeYears: 1.5, termYears: 0, description: 'א'.repeat(3001), availability: 'sold' }),
    );
    expect(errors.title).toBe('נא לתת כותרת קצרה למודעה');
    expect(errors.description).toBe('עד 3000 תווים');
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['roofAgeYears', 'termYears', 'availability']));
  });

  it('reports Hebrew messages for all custom rules', () => {
    const errors = errorsOf(listingSchema.safeParse({ ...base, ownerDisplayName: '', title: '', locality: '', declared: false }));
    for (const key of ['ownerDisplayName', 'title', 'locality', 'declared']) {
      expect(isHebrew(errors[key]), key).toBe(true);
    }
  });
});

describe('fieldErrors', () => {
  it('keeps only the first message per field path', () => {
    const r = inquirySchema.safeParse({ listingId: LISTING_ID, senderName: '', senderContact: 'x', senderRole: 'investor', message: '' });
    const errors = errorsOf(r);
    expect(errors).toEqual({
      senderName: 'נא להזין שם',
      senderContact: 'נא להזין טלפון או דוא״ל תקינים',
      message: 'נא לכתוב הודעה קצרה',
    });
  });
});
