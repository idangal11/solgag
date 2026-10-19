'use client';

import { useId, useOptimistic, useTransition } from 'react';
import { callAction } from '@/app/dashboard/_lib/callAction';
import { setInquiryStatus } from '@/app/inquiries/actions';
import { useApp } from '@/components/AppProvider';
import { INQUIRY_STATUS } from '@/lib/labels';
import type { InquiryStatus } from '@/lib/types';

const STATUSES = Object.keys(INQUIRY_STATUS) as InquiryStatus[];

/** Listing owner's quick status control for a received inquiry. */
export function InquiryStatusSelect({ inquiryId, status, label = 'עדכון סטטוס' }: { inquiryId: string; status: InquiryStatus; label?: string }) {
  const { toast } = useApp();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(status);

  const change = (next: InquiryStatus) => {
    if (next === status) return;
    // On failure the optimistic value falls back to `status` when the transition ends.
    startTransition(async () => {
      setShown(next);
      const res = await callAction(() => setInquiryStatus(inquiryId, next));
      if (!res.ok) toast(res.error, 'error');
      else toast(`סטטוס הפנייה עודכן: ${INQUIRY_STATUS[next].label}`, 'info');
    });
  };

  return (
    <span className="dash-status-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={shown} disabled={pending} aria-busy={pending} onChange={(e) => change(e.target.value as InquiryStatus)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {INQUIRY_STATUS[s].label}
          </option>
        ))}
      </select>
    </span>
  );
}
