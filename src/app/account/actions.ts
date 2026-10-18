'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeNextPath } from '@/components/auth/paths';
import { STORAGE_BUCKETS } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation';

export interface ProfileFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface DeleteAccountState {
  error?: string;
}

const DELETE_CONFIRMATION = 'מחיקה';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'נא להזין שם מלא (לפחות 2 תווים)').max(100, 'עד 100 תווים'),
  phone: z
    .string()
    .trim()
    .max(30, 'עד 30 תווים')
    .refine((v) => v === '' || (/^\+?[0-9\-\s()]+$/.test(v) && v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 15), 'נא להזין מספר טלפון תקין, למשל 050-1234567')
    .transform((v) => (v === '' ? null : v)),
  role: z.enum(['owner', 'investor'], { error: 'נא לבחור אפשרות' }),
});

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName') ?? '',
    phone: formData.get('phone') ?? '',
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'יש לתקן את השדות המסומנים.', fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone, role: parsed.data.role })
    .eq('id', user.id)
    .select('id');
  if (error) {
    console.error('updateProfile', error);
    return { status: 'error', message: 'לא הצלחנו לשמור את הפרטים. נסו שוב בעוד רגע.' };
  }
  if (!data?.length) {
    return { status: 'error', message: 'פרופיל המשתמש לא נמצא. נסו לצאת ולהיכנס מחדש.' };
  }

  revalidatePath('/', 'layout'); // header avatar + anything showing the name
  if (formData.get('welcome') === '1') redirect(safeNextPath(formData.get('next')));
  return { status: 'ok', message: 'הפרטים נשמרו' };
}

/** Removes every object under "<userId>/" in a bucket (uploads always live in the user's folder). */
async function removeUserFiles(admin: SupabaseClient, bucket: string, userId: string) {
  const paths: string[] = [];
  const walk = async (prefix: string, depth: number) => {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else if (depth < 4) await walk(path, depth + 1); // folders have no id
    }
  };
  await walk(userId, 0);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

export async function deleteAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const confirmation = String(formData.get('confirm') ?? '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .trim();
  if (confirmation !== DELETE_CONFIRMATION) {
    return { error: `כדי למחוק את החשבון יש להקליד "${DELETE_CONFIRMATION}" בשדה האישור.` };
  }

  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const admin = createAdminClient();
  if (!admin) {
    return {
      error: 'לא ניתן למחוק את החשבון באופן אוטומטי כרגע. נא לפנות לצוות סולגג (פרטי הקשר בעמוד "אודות") ונמחק אותו עבורכם.',
    };
  }

  // Uploaded files are not covered by the database cascade; ownership documents in particular must go.
  for (const bucket of [STORAGE_BUCKETS.ownershipDocs, STORAGE_BUCKETS.listingImages]) {
    try {
      await removeUserFiles(admin, bucket, user.id);
    } catch (err) {
      console.error('deleteAccount: storage cleanup failed', bucket, err);
      return { error: 'מחיקת הקבצים שהעליתם נכשלה, ולכן החשבון לא נמחק. נסו שוב בעוד רגע או פנו לצוות סולגג.' };
    }
  }

  // Cascades to the profile, listings, favorites, inquiries and messages.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('deleteAccount: deleteUser failed', error);
    return { error: 'מחיקת החשבון נכשלה. נסו שוב בעוד רגע, ואם הבעיה חוזרת פנו לצוות סולגג.' };
  }

  // The user no longer exists; signing out just clears this browser's session cookies.
  const supabase = await createClient();
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) {
    const store = await cookies();
    for (const c of store.getAll()) if (c.name.startsWith('sb-')) store.delete(c.name);
  }
  revalidatePath('/', 'layout');
  redirect('/');
}
