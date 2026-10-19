'use client';

import { Eye, EyeOff, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { callAction } from '@/app/dashboard/_lib/callAction';
import { deleteListing, setListingStatus } from '@/app/dashboard/actions';
import { useApp } from '@/components/AppProvider';
import { ListingCard } from '@/components/ListingCard';
import { Tag } from '@/components/ui';
import { fmtDate } from '@/lib/labels';
import type { Listing, VerificationRequest } from '@/lib/types';
import { VerificationBox } from './VerificationBox';

interface Props {
  listing: Listing;
  requests: VerificationRequest[];
  documentUrls: Record<string, string>;
}

/** One of the owner's listings: card + publish/hide, edit, delete and ownership verification. */
export function MyListingItem({ listing, requests, documentUrls }: Props) {
  const { toast } = useApp();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const deleteBtn = useRef<HTMLButtonElement>(null);
  // Staff moderation wins over the owner's own publish/hide choice: the DB keeps
  // an admin-hidden listing out of search, the map and new inquiries whatever its status.
  const adminHidden = listing.adminHidden;
  const published = listing.status === 'published' && !adminHidden;

  useEffect(() => {
    if (confirming) cancelBtn.current?.focus();
  }, [confirming]);

  const toggle = () => {
    if (adminHidden) return;
    startTransition(async () => {
      const next = published ? 'hidden' : 'published';
      const res = await callAction(() => setListingStatus(listing.id, next));
      if (!res.ok) {
        toast(
          res.reason === 'network' ? 'החיבור לשרת נכשל, וייתכן שמצב הפרסום לא עודכן. רעננו את העמוד כדי לראות את המצב העדכני.' : res.error,
          'error',
        );
      } else toast(next === 'hidden' ? 'המודעה הוסתרה מהחיפוש ומהמפה' : 'המודעה פורסמה מחדש', 'info');
    });
  };

  const closeConfirm = () => {
    setConfirming(false);
    deleteBtn.current?.focus();
  };

  const remove = () =>
    startTransition(async () => {
      const res = await callAction(() => deleteListing(listing.id));
      if (!res.ok) {
        toast(
          res.reason === 'network' ? 'החיבור לשרת נכשל, וייתכן שהמודעה לא נמחקה. רעננו את העמוד כדי לראות את המצב העדכני.' : res.error,
          'error',
        );
        return;
      }
      toast('המודעה נמחקה');
      document.getElementById('my-listings-heading')?.focus();
    });

  return (
    <div className="dash-my-item">
      <ListingCard listing={listing} />
      <div className="dash-manage" role="group" aria-label={`ניהול המודעה ${listing.title}`}>
        <div className="dash-manage-top">
          {adminHidden ? (
            <Tag tone="bad" icon={<ShieldAlert size={14} aria-hidden />}>
              הוסתרה על ידי צוות האתר
            </Tag>
          ) : (
            <Tag tone={published ? 'ok' : 'muted'} icon={published ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}>
              {published ? 'מפורסמת' : 'מוסתרת'}
            </Tag>
          )}
          <span className="tiny muted" suppressHydrationWarning>
            עודכנה {fmtDate(listing.updatedAt)}
          </span>
        </div>
        {adminHidden ? (
          <p className="hint dash-admin-hidden">
            צוות האתר הסתיר את המודעה: היא אינה מופיעה בחיפוש ובמפה, ולא ניתן לשלוח עליה פניות חדשות. שיחות קיימות ממשיכות. אי אפשר לפרסם
            אותה מחדש מכאן — לבירור אפשר לפנות לצוות האתר (פרטי הקשר בעמוד <Link href="/about#contact-title">אודות</Link>).
          </p>
        ) : (
          !published && (
            <p className="hint">המודעה מוסתרת: היא אינה מופיעה בחיפוש ובמפה, ולא ניתן לשלוח עליה פניות חדשות. שיחות קיימות ממשיכות.</p>
          )
        )}
        <div className="dash-btns">
          <Link className="btn ghost sm" href={`/listing/${listing.id}/edit`} aria-label={`עריכה — ${listing.title}`}>
            <Pencil size={15} aria-hidden /> עריכה
          </Link>
          {!adminHidden && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={toggle}
              disabled={pending}
              aria-label={`${published ? 'הסתרה' : 'פרסום מחדש'} — ${listing.title}`}
            >
              {published ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              {published ? 'הסתרה' : 'פרסום מחדש'}
            </button>
          )}
          <button
            ref={deleteBtn}
            type="button"
            className="btn danger-ghost sm"
            onClick={() => setConfirming(true)}
            disabled={pending}
            aria-expanded={confirming}
            aria-controls={confirming ? `${id}-confirm` : undefined}
            aria-label={`מחיקה — ${listing.title}`}
          >
            <Trash2 size={15} aria-hidden /> מחיקה
          </button>
        </div>

        {confirming && (
          <div
            id={`${id}-confirm`}
            className="dash-confirm"
            role="alertdialog"
            aria-labelledby={`${id}-del-t`}
            aria-describedby={`${id}-del-d`}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !pending) closeConfirm();
            }}
          >
            <b id={`${id}-del-t`}>למחוק את המודעה לצמיתות?</b>
            <p id={`${id}-del-d`} className="small">
              המחיקה תסיר גם את התמונות, את הפניות וההודעות שהתקבלו על המודעה ואת בקשות אימות הבעלות. לא ניתן לשחזר.
              {!adminHidden && ' כדי רק להפסיק לקבל פניות אפשר להסתיר את המודעה.'}
            </p>
            <div className="dash-btns">
              <button type="button" className="btn sm dash-btn-danger" onClick={remove} disabled={pending}>
                <Trash2 size={15} aria-hidden /> {pending ? 'מוחק…' : 'מחיקה סופית'}
              </button>
              <button ref={cancelBtn} type="button" className="btn ghost sm" onClick={closeConfirm} disabled={pending}>
                ביטול
              </button>
            </div>
          </div>
        )}

        <VerificationBox
          listingId={listing.id}
          listingTitle={listing.title}
          status={listing.ownerVerification}
          requests={requests}
          documentUrls={documentUrls}
        />
      </div>
    </div>
  );
}
