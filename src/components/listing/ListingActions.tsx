'use client';

import { Calculator as CalcIcon, Heart, LayoutDashboard, Loader2, MessageSquare, Pencil } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { fmtSqm } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import type { InquiryDialogProps } from './InquiryDialog';
import { inquiryBlock } from './inquiryGate';

/** Shown instead of the form when its code could not be downloaded (offline, new deployment). */
function InquiryLoadError({ onClose }: InquiryDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="inq-load-title" aria-describedby="inq-load-desc">
        <h2 id="inq-load-title">לא ניתן לפתוח את טופס הפנייה</h2>
        <p id="inq-load-desc">ייתכן שהחיבור לאינטרנט נקטע או שהאתר עודכן. יש לרענן את הדף ולנסות שוב.</p>
        <div className="row-btns">
          <button type="button" className="btn primary" onClick={() => window.location.reload()} autoFocus>
            רענון הדף
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            סגירה
          </button>
        </div>
      </div>
    </div>
  );
}

// The dialog (and zod, through its validation) loads only when needed: it is preloaded
// on hover/focus/press of the inquiry buttons and rendered after the click.
const loadInquiryDialog = () => import('./InquiryDialog');
const InquiryDialog = dynamic<InquiryDialogProps>(
  () =>
    import('./InquiryDialog')
      .then((m) => m.InquiryDialog)
      .catch(() => InquiryLoadError),
  {
    ssr: false,
    loading: () => (
      <div className="modal-backdrop" role="status">
        <Loader2 size={28} className="spin inq-loading" aria-hidden="true" />
        <span className="sr-only">טוען את טופס הפנייה…</span>
      </div>
    ),
  },
);

type ActionListing = Pick<
  Listing,
  | 'id'
  | 'title'
  | 'locality'
  | 'usableAreaSqm'
  | 'totalAreaSqm'
  | 'isFictional'
  | 'isMine'
  | 'status'
  | 'adminHidden'
  | 'availability'
>;

interface Props {
  listing: ActionListing;
  /** From the signed-in user's profile; empty strings when unknown. */
  prefill: { name: string; contact: string };
}

/** Sticky action card (desktop), bottom action bar (tablet/mobile) and the inquiry dialog. */
export function ListingActions({ listing, prefill }: Props) {
  const { user, favorites, toggleFavorite, requireAuth } = useApp();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const fav = favorites.has(listing.id);
  const block = inquiryBlock(listing);
  const editHref = `/listing/${listing.id}/edit`;

  // Anonymous visitors are sent to sign in instead, so they never need the dialog code.
  const preloadInquiry = () => {
    if (!block && user) void loadInquiryDialog().catch(() => {});
  };
  const preloadProps = { onPointerEnter: preloadInquiry, onPointerDown: preloadInquiry, onFocus: preloadInquiry };

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
            {...preloadProps}
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
          <button type="button" className="btn primary block" onClick={openInquiry} {...preloadProps} disabled={!!block}>
            <MessageSquare size={17} aria-hidden="true" /> {block ? block.short : 'אני מתעניין/ת'}
          </button>
        )}
      </div>

      {open && <InquiryDialog listing={listing} prefill={prefill} onClose={close} />}
    </>
  );
}
