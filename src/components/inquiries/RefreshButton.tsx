'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Re-fetches the thread (there is no realtime subscription). */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="רענון השיחה לבדיקת הודעות חדשות"
    >
      <RefreshCw size={15} className={pending ? 'spin' : undefined} aria-hidden />
      <span>רענון</span>
    </button>
  );
}
