'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function InquiryError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page narrow empty-page" role="alert">
      <h1>לא הצלחנו לטעון את השיחה</h1>
      <p className="muted">אירעה תקלה בטעינת ההודעות. נסו שוב בעוד רגע.</p>
      <div className="row-btns">
        <button type="button" className="btn primary" onClick={() => retry()}>
          נסו שוב
        </button>
        <Link className="btn ghost" href="/dashboard">
          לאזור האישי
        </Link>
      </div>
    </div>
  );
}
