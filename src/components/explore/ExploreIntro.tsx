'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

const INTRO_KEY = 'solgag.v1.introClosed';
const noopSubscribe = () => () => {};

function readClosed(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

/** Dismissible "how it works" box. Remembered per browser; never blocks if storage is unavailable. */
export function ExploreIntro({ onClose }: { onClose?: () => void }) {
  // The server render assumes "closed" so returning visitors never see it flash.
  const storedClosed = useSyncExternalStore(noopSubscribe, readClosed, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (storedClosed || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* storage unavailable — the box stays closed for this visit */
    }
    onClose?.();
  };

  return (
    <section className="intro" aria-label="איך זה עובד?">
      <button type="button" className="icon-btn close" aria-label="סגירת ההסבר" onClick={close}>
        <X size={14} aria-hidden />
      </button>
      <b>איך זה עובד?</b>
      <ol>
        <li>
          <span aria-hidden>1</span>בעלי מחסנים, מפעלים ורפתות מציעים גג פנוי
        </li>
        <li>
          <span aria-hidden>2</span>משקיע מממן מערכת סולארית ומחשב תרחיש
        </li>
        <li>
          <span aria-hidden>3</span>הצדדים מתקשרים בשכירות או בחלוקת הכנסות
        </li>
      </ol>
      <div className="intro-cta">
        <Link className="btn accent sm" href="/publish">
          יש לי גג — לפרסום
        </Link>
        <button type="button" className="btn ghost sm" onClick={close}>
          אני משקיע/ה — לגגות
        </button>
      </div>
    </section>
  );
}
