'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { Logo } from '@/components/Logo';
import './globals.css';
import '@/styles/site.css';

// Replaces the root layout when it fails, so it renders its own document and
// cannot rely on the app shell, providers or fonts.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body>
        <title>תקלה · סולגג</title>
        <main className="global-error">
          <Logo size={48} />
          <h1>משהו השתבש</h1>
          <p className="muted">אירעה תקלה בלתי צפויה בטעינת סולגג. נסו שוב בעוד רגע.</p>
          <div className="sys-links">
            <button type="button" className="btn primary" onClick={() => retry()}>
              <RotateCcw size={17} aria-hidden /> ניסיון חוזר
            </button>
            {/* A full page load, since the client router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn ghost" href="/">
              חזרה לדף הבית
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
