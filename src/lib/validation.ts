import { z } from 'zod';

// Shared input validation (client forms + server actions). The database
// constraints in supabase/migrations are the final authority.

const trimmed = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, `עד ${max} תווים`);

export const contactSchema = z
  .string()
  .trim()
  .max(254)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+?[0-9\-\s]{9,15}$/.test(v), 'נא להזין טלפון או דוא״ל תקינים');

export const inquirySchema = z.object({
  listingId: z.uuid(),
  senderName: trimmed(2, 100, 'נא להזין שם'),
  senderContact: contactSchema,
  senderRole: z.enum(['investor', 'installer', 'other']),
  message: trimmed(5, 2000, 'נא לכתוב הודעה קצרה'),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const messageSchema = z.object({
  inquiryId: z.uuid(),
  body: trimmed(1, 2000, 'ההודעה ריקה'),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `עד ${max} תווים`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

const latLng = z.tuple([z.number().min(29.4).max(33.4), z.number().min(34.2).max(35.95)]);

export const listingSchema = z
  .object({
    ownerDisplayName: trimmed(2, 100, 'נא להזין שם'),
    title: trimmed(4, 120, 'נא לתת כותרת קצרה למודעה'),
    buildingType: z.enum(['warehouse', 'factory', 'dairy', 'commercial', 'agri']),
    region: z.enum(['galilee', 'haifa', 'valleys', 'sharon', 'center', 'jerusalem', 'shfela', 'south', 'arava']),
    locality: trimmed(2, 80, 'נא להזין יישוב'),
    description: z.string().trim().max(3000, 'עד 3000 תווים'),
    location: latLng,
    polygon: z.array(latLng).max(200),
    areaSource: z.enum(['polygon', 'manual_measured', 'manual_estimate']),
    totalAreaSqm: z.number().min(50, 'השטח קטן מדי לגג מסחרי (פחות מ-50 מ״ר)').max(500000, 'שטח גדול מדי'),
    usableAreaSqm: z.number().positive(),
    roofType: optionalText(120),
    shading: optionalText(200),
    grid: optionalText(200),
    roofAgeYears: z.number().int().min(0).max(150).nullable(),
    agreement: z.enum(['fixed_rent', 'revenue_share', 'open']),
    rentPerSqmYear: z.number().min(0).max(1000).nullable(),
    sharePct: z.number().gt(0).lt(100).nullable(),
    termYears: z.number().int().min(1).max(50).nullable(),
    termsNotes: z.string().trim().max(1000, 'עד 1000 תווים'),
    availability: z.enum(['available', 'in_talks', 'unavailable']),
    declared: z.literal(true, { error: 'יש לאשר את ההצהרה כדי לפרסם' }),
  })
  .superRefine((v, ctx) => {
    if (v.areaSource === 'polygon' && v.polygon.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['polygon'], message: 'נא לשרטט לפחות 3 נקודות, או לעבור להזנת שטח ידנית' });
    }
    if (v.usableAreaSqm > v.totalAreaSqm) {
      ctx.addIssue({ code: 'custom', path: ['usableAreaSqm'], message: 'השטח השמיש גדול מהשטח הכולל' });
    }
    if (v.agreement === 'fixed_rent' && (v.rentPerSqmYear === null || v.rentPerSqmYear <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['rentPerSqmYear'], message: 'נא להזין שכירות מבוקשת' });
    }
    if (v.agreement === 'revenue_share' && v.sharePct === null) {
      ctx.addIssue({ code: 'custom', path: ['sharePct'], message: 'נא להזין אחוז בין 1 ל-99' });
    }
  });
export type ListingInput = z.infer<typeof listingSchema>;

/** First error message per field path, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}
