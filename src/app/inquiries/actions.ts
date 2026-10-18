'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { type ActionResult, dbErrorMessage, fail, NOT_SIGNED_IN } from '@/app/dashboard/_lib/actionResult';
import { notifyInquiryReply } from '@/lib/notify';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { InquiryStatus } from '@/lib/types';
import { messageSchema } from '@/lib/validation';

/** Adds a message to an inquiry thread (sender or listing owner only — enforced by RLS). */
export async function sendInquiryReply(input: { inquiryId: string; body: string }): Promise<ActionResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'ההודעה אינה תקינה');
  const user = await getCurrentUser();
  if (!user) return fail(NOT_SIGNED_IN);
  const { inquiryId, body } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('inquiry_messages').insert({ inquiry_id: inquiryId, sender_id: user.id, body });
  if (error) {
    console.error('sendInquiryReply', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לשלוח את ההודעה. נסו שוב.'));
  }

  // The message is saved; a failed e-mail notification must not fail the reply.
  after(async () => {
    try {
      await notifyInquiryReply({ inquiryId });
    } catch (e) {
      console.error('notifyInquiryReply failed', inquiryId, e);
    }
  });

  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

const statusSchema = z.enum(['new', 'in_progress', 'closed']);

/** Listing owner changes an inquiry's status (only the status column is writable). */
export async function setInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<ActionResult> {
  if (!z.uuid().safeParse(inquiryId).success || !statusSchema.safeParse(status).success) return fail('בקשה לא תקינה');
  const user = await getCurrentUser();
  if (!user) return fail(NOT_SIGNED_IN);

  const supabase = await createClient();
  const { data, error } = await supabase.from('inquiries').update({ status }).eq('id', inquiryId).select('id');
  if (error) {
    console.error('setInquiryStatus', error);
    return fail(dbErrorMessage(error, 'לא הצלחנו לעדכן את סטטוס הפנייה. נסו שוב.'));
  }
  if (!data?.length) return fail('רק בעלי המודעה יכולים לעדכן את סטטוס הפנייה.');

  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}
