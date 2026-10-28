'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useApp } from '@/components/AppProvider';
import { callAction } from '../callAction';
import type { ActionResult } from '../types';

/** Runs an admin Server Action in a transition, toasts the outcome and refreshes the page data. */
export function useAdminAction() {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T extends object>(action: () => Promise<ActionResult<T>>, success: string | ((res: { ok: true } & T) => string), after?: () => void) {
    startTransition(async () => {
      const res = await callAction(action);
      if (!res.ok) {
        toast(res.error, 'error');
        if (res.stale) router.refresh();
        return;
      }
      toast(typeof success === 'string' ? success : success(res));
      after?.();
      router.refresh();
    });
  }

  return { pending, run };
}
