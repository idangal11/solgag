import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { publicConfig, SITE_NAME } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/admin';

// Transactional email notifications. Every export is safe to call without
// awaiting the outcome: when Resend or the service-role key is not configured
// it is a no-op, and all failures are logged — never thrown.
//
// Emails only say that something happened and link to the app. They never
// contain the other side's contact details or message text; participants read
// those in the personal area, under RLS.

interface Mailer {
  resend: Resend;
  from: string;
}

function getMailer(): Mailer | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.NOTIFY_FROM_EMAIL?.trim();
  if (!from) {
    console.warn('[notify] RESEND_API_KEY is set but NOTIFY_FROM_EMAIL is missing — email skipped');
    return null;
  }
  return { resend: new Resend(apiKey), from };
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** User-supplied text as a single, length-capped line (titles, names). */
function oneLine(s: string, max = 80): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address we notify for a user: their profile contact email (synced from auth). */
async function contactEmailOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.from('profiles').select('contact_email').eq('id', userId).maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  const email = (data as { contact_email: string | null } | null)?.contact_email?.trim();
  return email && EMAIL_RE.test(email) ? email : null;
}

interface EmailContent {
  heading: string;
  /** Already-escaped HTML fragments, one per paragraph. */
  paragraphs: string[];
  /** Plain-text version of the same paragraphs. */
  text: string[];
  ctaLabel: string;
  ctaHref: string;
}

function renderEmail(c: EmailContent): { html: string; text: string } {
  const footer = `קיבלת הודעה זו כי יש לך חשבון ב${SITE_NAME}. פרטי הפנייה זמינים רק לאחר כניסה לאתר.`;
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f3;">
<div dir="rtl" style="max-width:520px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#15221c;text-align:right;line-height:1.6;">
  <div style="font-size:20px;font-weight:800;color:#0f3d2e;margin:0 4px 14px;">${esc(SITE_NAME)}</div>
  <div style="background:#ffffff;border:1px solid #e1e6e2;border-radius:14px;padding:20px;">
    <h1 style="font-size:18px;line-height:1.3;margin:0 0 12px;color:#0a2a20;">${esc(c.heading)}</h1>
    ${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;">${p}</p>`).join('\n    ')}
    <p style="margin:20px 0 4px;">
      <a href="${esc(c.ctaHref)}" style="display:inline-block;background:#0f3d2e;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;">${esc(c.ctaLabel)}</a>
    </p>
  </div>
  <p style="font-size:12px;color:#5e6b65;margin:16px 4px 0;">${esc(footer)}</p>
</div>
</body>
</html>`;
  const text = [c.heading, '', ...c.text, '', `${c.ctaLabel}: ${c.ctaHref}`, '', footer].join('\n');
  return { html, text };
}

async function send(m: Mailer, to: string, subject: string, content: EmailContent, idempotencyKey?: string) {
  const { html, text } = renderEmail(content);
  const { error } = await m.resend.emails.send(
    { from: m.from, to, subject, html, text },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (error) throw new Error(`resend: ${error.name}: ${error.message}`);
}

/** Tell a listing's owner that a new inquiry arrived. */
export async function notifyOwnerOfInquiry({ listingId, listingTitle }: { listingId: string; listingTitle: string }): Promise<void> {
  try {
    const mailer = getMailer();
    const admin = mailer ? createAdminClient() : null;
    if (!mailer || !admin) return;

    const { data, error } = await admin.from('listings').select('owner_id, is_fictional').eq('id', listingId).maybeSingle();
    if (error) throw new Error(`listings: ${error.message}`);
    const listing = data as { owner_id: string | null; is_fictional: boolean } | null;
    if (!listing?.owner_id || listing.is_fictional) return;

    const to = await contactEmailOf(admin, listing.owner_id);
    if (!to) return;

    // The sender's self-chosen name is NOT put in the email: it is attacker-controlled
    // text that would appear inside a platform-branded message (phishing vector).
    const title = oneLine(listingTitle);
    await send(mailer, to, `פנייה חדשה על הגג "${title}"`, {
      heading: 'התקבלה פנייה חדשה על הגג שלך',
      paragraphs: [
        `התקבלה פנייה חדשה על המודעה <b>"${esc(title)}"</b>.`,
        'את ההודעה ואת פרטי הקשר של הפונה אפשר לראות באזור האישי, ומשם גם להשיב.',
      ],
      text: [`התקבלה פנייה חדשה על המודעה "${title}".`, 'את ההודעה ואת פרטי הקשר של הפונה אפשר לראות באזור האישי, ומשם גם להשיב.'],
      ctaLabel: 'לצפייה בפנייה',
      ctaHref: `${publicConfig.siteUrl}/dashboard`,
    });
  } catch (e) {
    console.error('[notify] notifyOwnerOfInquiry failed', e);
  }
}

/** Bursts of messages from the same person within this window trigger one email. */
const REPLY_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Tell the other participant of an inquiry thread that a new message arrived.
 * The author is taken from the latest message, so call it right after inserting one.
 */
export async function notifyInquiryReply({ inquiryId }: { inquiryId: string }): Promise<void> {
  try {
    const mailer = getMailer();
    const admin = mailer ? createAdminClient() : null;
    if (!mailer || !admin) return;

    const { data: inqData, error: inqError } = await admin
      .from('inquiries')
      .select('id, sender_id, listings(title, owner_id)')
      .eq('id', inquiryId)
      .maybeSingle();
    if (inqError) throw new Error(`inquiries: ${inqError.message}`);
    type ListingRef = { title: string; owner_id: string | null };
    const inquiry = inqData as { id: string; sender_id: string; listings: ListingRef | ListingRef[] | null } | null;
    if (!inquiry) return;
    const listing = Array.isArray(inquiry.listings) ? inquiry.listings[0] : inquiry.listings;

    const { data: msgData, error: msgError } = await admin
      .from('inquiry_messages')
      .select('id, sender_id, created_at')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: false })
      .limit(2);
    if (msgError) throw new Error(`inquiry_messages: ${msgError.message}`);
    const [latest, previous] = (msgData ?? []) as { id: string; sender_id: string; created_at: string }[];
    if (!latest) return;
    if (previous && previous.sender_id === latest.sender_id && Date.parse(latest.created_at) - Date.parse(previous.created_at) < REPLY_THROTTLE_MS) {
      return;
    }

    const recipientId = latest.sender_id === inquiry.sender_id ? listing?.owner_id : inquiry.sender_id;
    if (!recipientId || recipientId === latest.sender_id) return;
    const to = await contactEmailOf(admin, recipientId);
    if (!to) return;

    const title = oneLine(listing?.title ?? 'מודעה שהוסרה');
    await send(
      mailer,
      to,
      `הודעה חדשה בפנייה על "${title}"`,
      {
        heading: 'התקבלה הודעה חדשה בפנייה',
        paragraphs: [`נוספה הודעה חדשה בשיחה על המודעה <b>"${esc(title)}"</b>.`, 'אפשר לקרוא אותה ולהשיב באזור האישי.'],
        text: [`נוספה הודעה חדשה בשיחה על המודעה "${title}".`, 'אפשר לקרוא אותה ולהשיב באזור האישי.'],
        ctaLabel: 'לקריאת ההודעה',
        ctaHref: `${publicConfig.siteUrl}/inquiries/${encodeURIComponent(inquiryId)}`,
      },
      `inquiry-message-${latest.id}`,
    );
  } catch (e) {
    console.error('[notify] notifyInquiryReply failed', e);
  }
}

/** Tell a listing owner that their ownership-verification request was reviewed. */
export async function notifyVerificationDecision({ requestId }: { requestId: string }): Promise<void> {
  try {
    const mailer = getMailer();
    const admin = mailer ? createAdminClient() : null;
    if (!mailer || !admin) return;

    const { data, error } = await admin
      .from('verification_requests')
      .select('owner_id, status, listings(title)')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw new Error(`verification_requests: ${error.message}`);
    type Ref = { title: string };
    const req = data as { owner_id: string; status: string; listings: Ref | Ref[] | null } | null;
    if (!req || req.status === 'pending') return;

    const to = await contactEmailOf(admin, req.owner_id);
    if (!to) return;

    const listing = Array.isArray(req.listings) ? req.listings[0] : req.listings;
    const title = oneLine(listing?.title ?? 'המודעה שלך');
    const approved = req.status === 'approved';
    const line = approved
      ? 'צוות הפלטפורמה בדק את מסמך הבעלות שהגשת. המודעה מסומנת כעת "בעלות נבדקה מול מסמכים" — אין בכך אישור משפטי או ערובה.'
      : 'המסמכים שהוגשו לא הספיקו לאימות הבעלות. אפשר להגיש מסמכים חדשים מהאזור האישי.';
    await send(
      mailer,
      to,
      approved ? `מסמך הבעלות על "${title}" נבדק` : `אימות הבעלות על "${title}" לא אושר`,
      {
        heading: approved ? 'מסמך הבעלות נבדק ואושר' : 'בקשת אימות הבעלות לא אושרה',
        paragraphs: [`המודעה: <b>"${esc(title)}"</b>.`, esc(line)],
        text: [`המודעה: "${title}".`, line],
        ctaLabel: 'לאזור האישי',
        ctaHref: `${publicConfig.siteUrl}/dashboard`,
      },
      `verification-decision-${requestId}`,
    );
  } catch (e) {
    console.error('[notify] notifyVerificationDecision failed', e);
  }
}
