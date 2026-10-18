'use client';

import { Map as MapIcon, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import '@/styles/site.css';

function digestOf(error: unknown): string | null {
  if (error instanceof Error && 'digest' in error && typeof error.digest === 'string') return error.digest;
  return null;
}

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const digest = digestOf(error);

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <div className="page narrow sys-page">
      <h1 ref={headingRef} tabIndex={-1}>
        משהו השתבש
      </h1>
      <p className="muted">לא הצלחנו להציג את הדף. ייתכן שמדובר בתקלה זמנית — נסו שוב בעוד רגע.</p>
      {digest && (
        <p className="tiny muted">
          קוד תקלה לפנייה לתמיכה: <bdi dir="ltr">{digest}</bdi>
        </p>
      )}
      <div className="sys-links">
        <button type="button" className="btn primary" onClick={() => retry()}>
          <RotateCcw size={17} aria-hidden /> ניסיון חוזר
        </button>
        <Link className="btn ghost" href="/">
          <MapIcon size={17} aria-hidden /> למפת הגגות
        </Link>
      </div>
    </div>
  );
}
