import { ArrowRight, Inbox, Lock, MessagesSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ContactLink } from '@/components/inquiries/ContactLink';
import { InquiryStatusSelect } from '@/components/inquiries/InquiryStatusSelect';
import { MessageThread } from '@/components/inquiries/MessageThread';
import { RefreshButton } from '@/components/inquiries/RefreshButton';
import { ReplyForm } from '@/components/inquiries/ReplyForm';
import { StatusBadge, Tag } from '@/components/ui';
import { mapInquiryMessage, type InquiryMessageRow } from '@/lib/data/mappers';
import { getInquiry, getListing } from '@/lib/data/queries';
import { fmtDate, INQUIRY_ROLE_LABEL, INQUIRY_STATUS } from '@/lib/labels';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import '@/styles/dashboard.css';

export const metadata: Metadata = {
  title: 'שיחה על פנייה',
  robots: { index: false, follow: false },
};

export default async function InquiryThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/inquiries/${id}`)}`);

  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();

  const supabase = await createClient();
  const [{ data, error }, listing] = await Promise.all([
    supabase
      .from('inquiry_messages')
      .select('id, inquiry_id, sender_id, body, created_at')
      .eq('inquiry_id', inquiry.id)
      .order('created_at', { ascending: true })
      .limit(500),
    // null when the listing is hidden and I am the sender (RLS) — the thread still works.
    getListing(inquiry.listingId),
  ]);
  if (error) throw new Error(`inquiry_messages: ${error.message}`);
  const messages = ((data ?? []) as InquiryMessageRow[]).map((r) => mapInquiryMessage(r, user.id));

  const isOwner = !inquiry.sentByMe && listing?.isMine === true;
  const isParticipant = inquiry.sentByMe || isOwner;
  const otherParty = !isParticipant ? 'משתתף/ת בשיחה' : inquiry.sentByMe ? listing?.ownerDisplayName || 'בעלי הגג' : inquiry.senderName;
  const status = INQUIRY_STATUS[inquiry.status];

  return (
    <div className="page narrow dash-thread">
      <Link className="btn link sm dash-back" href={`/dashboard?tab=${isOwner ? 'owner' : 'investor'}`}>
        <ArrowRight size={16} aria-hidden /> חזרה לאזור האישי
      </Link>

      <header className="dash-thread-head">
        <div>
          <h1>{inquiry.sentByMe ? 'הפנייה שלך' : `פנייה מאת ${inquiry.senderName}`}</h1>
          <p className="muted">
            על המודעה:{' '}
            {listing ? (
              <Link href={`/listing/${listing.id}`}>{inquiry.listingTitle}</Link>
            ) : (
              <>
                {inquiry.listingTitle} <span className="tiny">(המודעה אינה מוצגת כרגע)</span>
              </>
            )}
          </p>
        </div>
        <div className="dash-thread-status">
          <Tag tone={status.tone}>{status.label}</Tag>
          {listing && <StatusBadge status={listing.availability} />}
          <RefreshButton />
        </div>
      </header>

      {isOwner && (
        <div className="card-surface dash-owner-tools">
          <InquiryStatusSelect inquiryId={inquiry.id} status={inquiry.status} label="סטטוס הפנייה" />
          <p className="hint">הסטטוס מוצג גם לפונה. תשובה ראשונה שלך מעבירה פנייה חדשה ל„בטיפול״ באופן אוטומטי.</p>
        </div>
      )}

      <section className="card-surface dash-original" aria-labelledby="original-heading">
        <h2 id="original-heading">
          <Inbox size={18} aria-hidden /> הפנייה המקורית
        </h2>
        <dl className="dash-orig-meta">
          <div>
            <dt>שם</dt>
            <dd>{inquiry.senderName}</dd>
          </div>
          <div>
            <dt>פונה בתור</dt>
            <dd>{INQUIRY_ROLE_LABEL[inquiry.senderRole]}</dd>
          </div>
          <div>
            <dt>פרטי קשר</dt>
            <dd>
              <ContactLink contact={inquiry.senderContact} />
            </dd>
          </div>
          <div>
            <dt>נשלחה</dt>
            <dd>
              <time dateTime={inquiry.createdAt}>{fmtDate(inquiry.createdAt)}</time>
            </dd>
          </div>
        </dl>
        <p className="dash-msg-body dash-orig-body">{inquiry.message}</p>
        <p className="hint dash-privacy">
          <Lock size={13} aria-hidden /> פרטי הקשר בפנייה גלויים רק לפונה, לבעלי המודעה ולצוות הפלטפורמה.
        </p>
      </section>

      <section className="dash-thread-section" aria-labelledby="thread-heading">
        <h2 id="thread-heading">
          <MessagesSquare size={18} aria-hidden /> המשך השיחה
        </h2>
        <MessageThread messages={messages} otherParty={otherParty} />
      </section>

      {isParticipant ? (
        <>
          {inquiry.status === 'closed' && <p className="note">הפנייה סומנה כסגורה. עדיין אפשר לשלוח הודעות בשיחה.</p>}
          <ReplyForm inquiryId={inquiry.id} />
        </>
      ) : (
        <p className="note">צפייה בלבד — אינך משתתף/ת בשיחה זו ולכן לא ניתן להשיב בה.</p>
      )}
    </div>
  );
}
