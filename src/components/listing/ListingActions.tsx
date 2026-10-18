'use client';

import { Calculator as CalcIcon, Heart, LayoutDashboard, MessageSquare, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { fmtSqm } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import { InquiryDialog } from './InquiryDialog';
import { inquiryBlock } from './inquiryGate';

type ActionListing = Pick<
  Listing,
  'id' | 'title' | 'locality' | 'usableAreaSqm' | 'totalAreaSqm' | 'isFictional' | 'isMine' | 'status' | 'availability'
>;

interface Props {
  listing: ActionListing;
  /** From the signed-in user's profile; empty strings when unknown. */
  prefill: { name: string; contact: string };
}

/** Sticky action card (desktop), bottom action bar (tablet/mobile) and the inquiry dialog. */
export function ListingActions({ listing, prefill }: Props) {
  const { favorites, toggleFavorite, requireAuth } = useApp();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const fav = favorites.has(listing.id);
  const block = inquiryBlock(listing);
  const editHref = `/listing/${listing.id}/edit`;

  const openInquiry = (e: MouseEvent<HTMLElement>) => {
    if (block) return;
    if (!requireAuth('כדי לשלוח פנייה יש להתחבר')) return;
    triggerRef.current = e.currentTarget;
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the button that opened the dialog.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const favLabel = fav ? 'שמור במועדפים' : 'שמירה למועדפים';

  return (
    <>
      <aside className="detail-aside" aria-label="פעולות על המודעה">
        <div className="action-card">
          <div className="ac-area">
            <span className="k">שטח שמיש מוערך</span>
            <span className="v">{fmtSqm(listing.usableAreaSqm)}</span>
            <span className="muted">מתוך {fmtSqm(listing.totalAreaSqm)} גג</span>
          </div>

          <button
            type="button"
            className="btn primary block lg"
            onClick={openInquiry}
            disabled={!!block}
            aria-describedby={block ? 'inq-block-reason' : undefined}
          >
            <MessageSquare size={18} aria-hidden="true" /> אני מתעניין/ת בגג הזה
          </button>

          {block?.reason === 'mine' ? (
            <div className="ac-mine" id="inq-block-reason">
              <b>{block.text}</b>
              <span className="muted">פניות שיתקבלו על הגג יופיעו באזור האישי שלך.</span>
              <div className="ac-mine-links">
                <Link className="btn ghost sm" href="/dashboard">
                  <LayoutDashboard size={15} aria-hidden="true" /> ניהול באזור האישי
                </Link>
                <Link className="btn ghost sm" href={editHref}>
                  <Pencil size={15} aria-hidden="true" /> עריכת המודעה
                </Link>
              </div>
            </div>
          ) : block ? (
            <small className="muted center" id="inq-block-reason">
              {block.text}
            </small>
          ) : null}

          <button
            type="button"
            className={`btn ghost block${fav ? ' fav-on' : ''}`}
            onClick={() => void toggleFavorite(listing.id)}
            aria-pressed={fav}
          >
            <Heart size={17} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" /> {favLabel}
          </button>
          <a className="btn link block" href="#calculator">
            <CalcIcon size={16} aria-hidden="true" /> לחישוב פיננסי
          </a>
          <p className="tiny muted ac-foot">
            {listing.isFictional
              ? 'מודעה בדויה. אין מאחוריה בעלים אמיתיים.'
              : 'פרטי המודעה נמסרו על ידי המפרסם. שליחת פנייה אינה מחייבת ואינה מהווה הצעה או התחייבות.'}
          </p>
        </div>
      </aside>

      <div className="mobile-actionbar">
        <button
          type="button"
          className={`icon-btn lg${fav ? ' fav-on' : ''}`}
          onClick={() => void toggleFavorite(listing.id)}
          aria-label={favLabel}
          aria-pressed={fav}
        >
          <Heart size={20} fill={fav ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        {block?.reason === 'mine' ? (
          <>
            <Link className="btn ghost block" href="/dashboard">
              <LayoutDashboard size={16} aria-hidden="true" /> ניהול
            </Link>
            <Link className="btn primary block" href={editHref}>
              <Pencil size={16} aria-hidden="true" /> עריכת המודעה
            </Link>
          </>
        ) : (
          <button type="button" className="btn primary block" onClick={openInquiry} disabled={!!block}>
            <MessageSquare size={17} aria-hidden="true" /> {block ? block.short : 'אני מתעניין/ת'}
          </button>
        )}
      </div>

      {open && <InquiryDialog listing={listing} prefill={prefill} onClose={close} />}
    </>
  );
}
