'use client';

import { useEffect } from 'react';

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page narrow empty-page" role="alert">
      <h1>לא הצלחנו לטעון את האזור האישי</h1>
      <p className="muted">אירעה תקלה בטעינת הנתונים. נסו שוב בעוד רגע.</p>
      <button type="button" className="btn primary" onClick={() => retry()}>
        נסו שוב
      </button>
    </div>
  );
}
