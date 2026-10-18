import type { Listing } from '@/lib/types';

// Why a listing cannot receive an inquiry — mirrors the RLS insert policy on
// public.inquiries, so the UI explains the refusal before the database does.

export interface InquiryBlock {
  reason: 'mine' | 'fictional' | 'hidden' | 'unavailable';
  /** Full explanation, shown next to the disabled button. */
  text: string;
  /** Fits on the mobile action bar button. */
  short: string;
}

export type InquiryGateListing = Pick<Listing, 'isMine' | 'isFictional' | 'status' | 'availability'>;

export function inquiryBlock(l: InquiryGateListing): InquiryBlock | null {
  if (l.isMine) return { reason: 'mine', text: 'זו המודעה שלך', short: 'זו המודעה שלך' };
  if (l.isFictional) return { reason: 'fictional', text: 'מודעה לדוגמה — לא ניתן לשלוח פנייה', short: 'מודעה לדוגמה — אין פניות' };
  if (l.status !== 'published') return { reason: 'hidden', text: 'המודעה מוסתרת ואינה פתוחה לפניות', short: 'מוסתרת — אין פניות' };
  if (l.availability === 'unavailable') return { reason: 'unavailable', text: 'הגג אינו זמין כרגע לפניות', short: 'לא זמין לפניות כרגע' };
  return null;
}
