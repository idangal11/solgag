'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult } from '@/components/admin/types';
import { getMyProfile } from '@/lib/data/queries';
import { prospectImportSchema } from '@/lib/prospects';
import { createClient } from '@/lib/supabase/server';

// Business-prospect pilot mutations. Like the other admin actions they re-check
// the admin flag here and run under the admin's own session; RLS (is_admin),
// CHECK constraints and import_prospect_batch enforce the rules again in the DB.

type Failure = Extract<ActionResult, { ok: false }>;

const NOT_SIGNED_IN: Failure = { ok: false, error: 'פג תוקף ההתחברות. נא להתחבר מחדש.' };
const NOT_ADMIN: Failure = { ok: false, error: 'אין לך הרשאת ניהול לפעולה זו.' };
const HEBREW = /[֐-׿]/;
// Server Action bodies are capped at 1 MB by Next.js (serverActions.bodySizeLimit); the
// limit is kept site-wide, and larger research batches are split into several files.
const MAX_IMPORT_BYTES = 950 * 1024;

async function adminGate(): Promise<Failure | null> {
  try {
    const profile = await getMyProfile();
    if (!profile) return NOT_SIGNED_IN;
    return profile.isAdmin ? null : NOT_ADMIN;
  } catch (e) {
    console.error('[prospects] profile lookup', e);
    return { ok: false, error: 'לא הצלחנו לאמת את הרשאת הניהול. נסו שוב בעוד רגע.' };
  }
}

function dbError(error: { message: string; code?: string }): Failure {
  if (error.code === '42501') return { ok: false, error: 'אין לך הרשאה לבצע פעולה זו.' };
  if (error.code === '23514') return { ok: false, error: 'הנתונים לא עברו את בדיקות המסד: לכל פרט קשר חייב להיות קישור למקור, ו״בעלות״ דורשת ראיה כתובה.' };
  if (HEBREW.test(error.message)) return { ok: false, error: error.message };
  console.error('[prospects]', error);
  return { ok: false, error: 'הפעולה נכשלה. נסו שוב בעוד רגע.' };
}

const firstIssue = (e: z.ZodError) => {
  const i = e.issues[0];
  return i ? `${i.path.join('.') || 'קלט'}: ${i.message}` : 'קלט לא תקין';
};

const done = () => revalidatePath('/admin/prospects');

// ─── Import ─────────────────────────────────────────────────────────────

export async function importProspects(formData: FormData): Promise<ActionResult<{ batch: string; roofs: number; businesses: number }>> {
  const denied = await adminGate();
  if (denied) return denied;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'נא לבחור קובץ JSON לייבוא.' };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: 'הקובץ גדול מ-950KB. פצלו את האצווה לכמה קבצים (ייבוא חוזר בטוח).' };

  let json: unknown;
  try {
    json = JSON.parse((await file.text()).replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: 'הקובץ אינו JSON תקין.' };
  }
  const parsed = prospectImportSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: `הקובץ לא עבר בדיקה — ${firstIssue(parsed.error)}` };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_prospect_batch', { p: parsed.data });
  if (error) return dbError(error);
  done();
  const res = data as { batch: string; roofs: number; businesses: number };
  return { ok: true, batch: res.batch, roofs: res.roofs, businesses: res.businesses };
}

// ─── Roof review ────────────────────────────────────────────────────────

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null);
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .transform((s) => s || null)
  .pipe(z.url({ protocol: /^https?$/, error: 'קישור המקור חייב להתחיל ב-http(s)://' }).nullable());

const roofReviewSchema = z
  .object({
    roofId: z.uuid(),
    status: z.enum(['pending', 'approved', 'corrected', 'rejected']),
    note: optional(2000),
    suitability: z.enum(['preliminary_unverified', 'plausible_after_review', 'unsuitable']).optional(),
    address: z
      .object({
        street: z.string().trim().min(1, 'נא למלא רחוב').max(120),
        houseNumber: optional(20),
        locality: optional(120),
        confidence: z.enum(['high', 'medium', 'low']),
        sourceNote: z.string().trim().min(3, 'נא לציין מאיפה הכתובת המתוקנת').max(500),
        sourceUrl: optionalUrl,
      })
      .optional(),
  })
  .refine((v) => !v.address || v.status === 'corrected', { message: 'תיקון כתובת נשמר בסטטוס „תוקן ואושר”', path: ['status'] });

export type RoofReviewInput = z.input<typeof roofReviewSchema>;

export async function reviewProspectRoof(input: RoofReviewInput): Promise<ActionResult> {
  const denied = await adminGate();
  if (denied) return denied;
  const parsed = roofReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { roofId, status, note, suitability, address } = parsed.data;

  const patch: Record<string, unknown> = { review_status: status, review_note: note };
  if (suitability) patch.suitability = suitability;
  if (address) {
    Object.assign(patch, {
      address_street: address.street,
      address_house_number: address.houseNumber,
      address_locality: address.locality,
      address_source: 'תיקון ידני של בודק/ת',
      address_source_url: address.sourceUrl,
      address_method: address.sourceNote,
      address_confidence: address.confidence,
    });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from('prospect_roofs').update(patch).eq('id', roofId).select('id');
  if (error) return dbError(error);
  if (!data?.length) return { ok: false, error: 'הגג לא נמצא. ייתכן שהאצווה הוסרה.', stale: true };
  done();
  return { ok: true };
}

// ─── Business review ────────────────────────────────────────────────────

const contactFields = {
  website: optionalUrl,
  websiteSourceUrl: optionalUrl,
  phone: optional(40),
  phoneSourceUrl: optionalUrl,
  email: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s || null)
    .pipe(z.email({ error: 'כתובת דוא״ל לא תקינה' }).nullable()),
  emailSourceUrl: optionalUrl,
};

const sourcedRefinements = <T extends z.ZodType<{ website: string | null; websiteSourceUrl: string | null; phone: string | null; phoneSourceUrl: string | null; email: string | null; emailSourceUrl: string | null }>>(s: T) =>
  s
    .refine((v) => !v.website || v.websiteSourceUrl, { message: 'לאתר חייב להיות קישור למקור (העמוד שבו הופיע)', path: ['websiteSourceUrl'] })
    .refine((v) => !v.phone || v.phoneSourceUrl, { message: 'לטלפון חייב להיות קישור למקור — אין לרשום פרט קשר בלי מקור', path: ['phoneSourceUrl'] })
    .refine((v) => !v.email || v.emailSourceUrl, { message: 'לדוא״ל חייב להיות קישור למקור — אין לרשום פרט קשר בלי מקור', path: ['emailSourceUrl'] });

const businessReviewSchema = z.object({
  businessId: z.uuid(),
  status: z.enum(['pending', 'approved', 'corrected', 'rejected']),
  note: optional(2000),
  correction: sourcedRefinements(
    z.object({
      name: z.string().trim().min(1, 'נא למלא שם עסק').max(200),
      relation: z.enum(['occupant_unverified', 'occupant_confirmed', 'owner_evidence', 'not_at_roof']),
      relationEvidence: optional(1000),
      matchConfidence: z.enum(['high', 'medium', 'low']),
      ...contactFields,
    }),
  )
    .refine((v) => v.relation !== 'owner_evidence' || (v.relationEvidence?.length ?? 0) >= 10, {
      message: 'סימון „יש ראיה לבעלות” דורש תיאור הראיה (למשל נסח טאבו מתאריך…)',
      path: ['relationEvidence'],
    })
    .optional(),
});

export type BusinessReviewInput = z.input<typeof businessReviewSchema>;

export async function reviewProspectBusiness(input: BusinessReviewInput): Promise<ActionResult> {
  const denied = await adminGate();
  if (denied) return denied;
  const parsed = businessReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { businessId, status, note, correction: c } = parsed.data;
  if (c && status !== 'corrected') return { ok: false, error: 'תיקון פרטים נשמר בסטטוס „תוקן ואושר”.' };

  const patch: Record<string, unknown> = { review_status: status, review_note: note };
  if (c) {
    Object.assign(patch, {
      name: c.name,
      relation: c.relation,
      relation_evidence: c.relationEvidence,
      match_confidence: c.matchConfidence,
      website: c.website,
      website_source_url: c.website ? c.websiteSourceUrl : null,
      phone: c.phone,
      phone_source_url: c.phone ? c.phoneSourceUrl : null,
      phone_snippet: null,
      email: c.email,
      email_source_url: c.email ? c.emailSourceUrl : null,
      email_snippet: null,
      contacts_checked_at: new Date().toISOString(),
    });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from('prospect_businesses').update(patch).eq('id', businessId).select('id');
  if (error) return dbError(error);
  if (!data?.length) return { ok: false, error: 'העסק לא נמצא. ייתכן שהאצווה הוסרה.', stale: true };
  done();
  return { ok: true };
}

const addBusinessSchema = sourcedRefinements(
  z.object({
    roofId: z.uuid(),
    name: z.string().trim().min(1, 'נא למלא שם עסק').max(200),
    matchConfidence: z.enum(['high', 'medium', 'low']),
    matchBasis: z.string().trim().min(5, 'נא לתאר על סמך מה העסק משויך לגג').max(1000),
    sourceUrl: z.url({ protocol: /^https?$/, error: 'נא לצרף קישור למקור (http/https)' }).max(1000),
    ...contactFields,
  }),
);

export type AddBusinessInput = z.input<typeof addBusinessSchema>;

/** A reviewer-found candidate. Needs a source; stays an occupant of unknown tenure. */
export async function addProspectBusiness(input: AddBusinessInput): Promise<ActionResult> {
  const denied = await adminGate();
  if (denied) return denied;
  const parsed = addBusinessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: roof, error: roofError } = await supabase.from('prospect_roofs').select('is_demo').eq('id', v.roofId).maybeSingle();
  if (roofError) return dbError(roofError);
  if (!roof) return { ok: false, error: 'הגג לא נמצא.', stale: true };

  const { error } = await supabase.from('prospect_businesses').insert({
    roof_id: v.roofId,
    is_demo: (roof as { is_demo: boolean }).is_demo,
    dedupe_key: `manual:${randomUUID()}`,
    name: v.name,
    relation: 'occupant_unverified',
    match_confidence: v.matchConfidence,
    match_basis: `נוסף ידנית: ${v.matchBasis}`,
    website: v.website,
    website_source_url: v.website ? v.websiteSourceUrl : null,
    phone: v.phone,
    phone_source_url: v.phone ? v.phoneSourceUrl : null,
    email: v.email,
    email_source_url: v.email ? v.emailSourceUrl : null,
    contacts_checked_at: v.phone || v.email ? new Date().toISOString() : null,
    sources: [{ url: v.sourceUrl, kind: 'other', label: 'נוסף ידנית ע״י בודק/ת' }],
    review_status: 'corrected',
  });
  if (error) return dbError(error);
  done();
  return { ok: true };
}
