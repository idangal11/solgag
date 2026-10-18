import { MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { ContactLink } from '@/components/inquiries/ContactLink';
import { InquiryStatusSelect } from '@/components/inquiries/InquiryStatusSelect';
import { Tag } from '@/components/ui';
import { fmtDate, INQUIRY_ROLE_LABEL, INQUIRY_STATUS } from '@/lib/labels';
import type { Inquiry } from '@/lib/types';

const excerpt = (s: string, max = 220) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

/** One row in "received" (listing owner) or "sent" (investor) inquiry lists. */
export function InquiryListItem({ inquiry: i }: { inquiry: Inquiry }) {
  const received = !i.sentByMe;
  const status = INQUIRY_STATUS[i.status];
  const listingLink = <Link href={`/listing/${i.listingId}`}>{i.listingTitle}</Link>;
  return (
    <li className={`inq-row dash-inq${received && i.status === 'new' ? ' is-new' : ''}`}>
      <div className="inq-top">
        <b>{received ? `מאת: ${i.senderName}` : <>אל: {listingLink}</>}</b>
        <time dateTime={i.createdAt}>{fmtDate(i.createdAt)}</time>
      </div>
      {received && (
        <span className="muted small">
          {INQUIRY_ROLE_LABEL[i.senderRole]} · על המודעה: {listingLink}
        </span>
      )}
      <p className="dash-inq-excerpt">{excerpt(i.message)}</p>
      <div className="inq-foot">
        <Tag tone={status.tone}>{status.label}</Tag>
        {received && <ContactLink contact={i.senderContact} />}
        {received && <InquiryStatusSelect inquiryId={i.id} status={i.status} />}
        <Link className="btn ghost sm" href={`/inquiries/${i.id}`} aria-label={`מעבר לשיחה — ${i.listingTitle}`}>
          <MessagesSquare size={15} aria-hidden /> לשיחה
        </Link>
      </div>
    </li>
  );
}
