import { MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { ContactLink } from '@/components/inquiries/ContactLink';
import { InquiryStatusSelect } from '@/components/inquiries/InquiryStatusSelect';
import { Tag } from '@/components/ui';
import { fmtDate, INQUIRY_ROLE_LABEL, INQUIRY_STATUS } from '@/lib/labels';
import type { Inquiry } from '@/lib/types';

const excerpt = (s: string, max = 220) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

/** Shown instead of the title when the listing is hidden (by its owner or by staff) and so not visible to me. */
export const LISTING_NOT_SHOWN = 'מודעה שאינה מוצגת כרגע';

interface Props {
  inquiry: Inquiry;
  /**
   * false when I cannot see the listing (it was hidden). Deleting a listing
   * deletes its inquiries, so an inquiry row always means the listing still
   * exists — it is never "removed", and its page would 404 for me.
   */
  listingVisible?: boolean;
}

/** One row in "received" (listing owner) or "sent" (investor) inquiry lists. */
export function InquiryListItem({ inquiry: i, listingVisible = true }: Props) {
  const received = !i.sentByMe;
  const status = INQUIRY_STATUS[i.status];
  const title = listingVisible ? i.listingTitle : LISTING_NOT_SHOWN;
  const listingLink = listingVisible ? (
    <Link href={`/listing/${i.listingId}`}>
      <bdi>{i.listingTitle}</bdi>
    </Link>
  ) : (
    <span className="dash-listing-gone">{LISTING_NOT_SHOWN}</span>
  );
  return (
    <li className={`inq-row dash-inq${received && i.status === 'new' ? ' is-new' : ''}`}>
      <div className="inq-top">
        <b>
          {received ? (
            <>
              מאת: <bdi>{i.senderName}</bdi>
            </>
          ) : (
            <>אל: {listingLink}</>
          )}
        </b>
        <time dateTime={i.createdAt}>{fmtDate(i.createdAt)}</time>
      </div>
      {received && (
        <span className="muted small">
          {INQUIRY_ROLE_LABEL[i.senderRole]} · על המודעה: {listingLink}
        </span>
      )}
      {!listingVisible && <span className="hint">המודעה הוסתרה ואינה מופיעה באתר, אך השיחה נשארת פתוחה וניתן להמשיך בה.</span>}
      <p className="dash-inq-excerpt" dir="auto">
        {excerpt(i.message)}
      </p>
      <div className="inq-foot">
        <Tag tone={status.tone}>{status.label}</Tag>
        {received && <ContactLink contact={i.senderContact} />}
        {received && <InquiryStatusSelect inquiryId={i.id} status={i.status} />}
        <Link className="btn ghost sm" href={`/inquiries/${i.id}`} aria-label={`מעבר לשיחה — ${title}`}>
          <MessagesSquare size={15} aria-hidden /> לשיחה
        </Link>
      </div>
    </li>
  );
}
