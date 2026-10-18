'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { inquiryBlock } from '@/components/listing/inquiryGate';
import { getListing } from '@/lib/data/queries';
import { notifyOwnerOfInquiry } from '@/lib/notify';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { fieldErrors, inquirySchema } from '@/lib/validation';

export type InquiryResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string>; needsAuth?: boolean };

const GENERIC_ERROR = 'שליחת הפנייה נכשלה. נסו שוב בעוד רגע.';

export async function submitInquiry(input: unknown): Promise<InquiryResult> {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, error: 'כדי לשלוח פנייה יש להתחבר' };

  // Read under the caller's RLS: explains a refusal in Hebrew before the insert policy rejects it.
  const listing = await getListing(v.listingId);
  if (!listing) return { ok: false, error: 'המודעה לא נמצאה או שהוסרה' };
  const block = inquiryBlock(listing);
  if (block) return { ok: false, error: block.reason === 'mine' ? 'לא ניתן לשלוח פנייה למודעה שלך' : block.text };

  const supabase = await createClient();
  const { error } = await supabase.from('inquiries').insert({
    listing_id: v.listingId,
    sender_id: user.id,
    sender_name: v.senderName,
    sender_contact: v.senderContact,
    sender_role: v.senderRole,
    message: v.message,
  });

  if (error) {
    // 54000: rate limit raised by the inquiries trigger — its message is already Hebrew.
    if (error.code === '54000') return { ok: false, error: error.message };
    if (error.code === '42501') return { ok: false, error: 'לא ניתן לשלוח פנייה למודעה זו כרגע' };
    if (error.code === '23503') return { ok: false, error: 'המודעה לא נמצאה או שהוסרה' };
    if (error.code === '23514') return { ok: false, error: 'חלק מהפרטים אינם תקינים. בדקו את הטופס ונסו שוב.' };
    if (error.code === 'PGRST301' || error.code === 'PGRST303') {
      return { ok: false, needsAuth: true, error: 'פג תוקף ההתחברות. יש להתחבר מחדש.' };
    }
    console.error('[submitInquiry] insert failed', error);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Email after the response is sent; notify never throws, but the action must not fail because of it.
  try {
    after(() => notifyOwnerOfInquiry({ listingId: listing.id, listingTitle: listing.title, senderName: v.senderName }));
  } catch (e) {
    console.error('[submitInquiry] could not schedule owner notification', e);
  }

  revalidatePath('/dashboard');
  return { ok: true };
}
