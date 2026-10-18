'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="empty admin-error" role="alert">
      <p>לא הצלחנו לטעון את נתוני הניהול. ייתכן שמדובר בתקלה זמנית בחיבור למסד הנתונים.</p>
      <button type="button" className="btn primary sm" onClick={() => retry()}>
        <RotateCcw size={15} aria-hidden /> ניסיון חוזר
      </button>
    </div>
  );
}
