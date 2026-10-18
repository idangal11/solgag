'use client';

import { Info, X } from 'lucide-react';
import { useId, useState } from 'react';
import { SAMPLE_STATUS } from '@/components/ui';
import { AVAILABILITY } from '@/lib/labels';
import type { Availability } from '@/lib/types';
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery';

const STATUSES = Object.keys(AVAILABILITY) as Availability[];

/** Map legend — open by default on desktop, collapsed on mobile until the user opens it. */
export function MapLegend() {
  // Assume mobile on the server so phones never flash an expanded legend.
  const isMobile = useMediaQuery(MOBILE_QUERY, true);
  const [pref, setPref] = useState<boolean | null>(null);
  const open = pref ?? !isMobile;
  const listId = useId();

  return (
    <div className={`legend${open ? '' : ' collapsed'}`}>
      <button type="button" className="legend-head" onClick={() => setPref(!open)} aria-expanded={open} aria-controls={open ? listId : undefined}>
        <Info size={15} aria-hidden /> מקרא {open ? <X size={14} aria-hidden /> : null}
      </button>
      {open && (
        <ul id={listId}>
          {STATUSES.map((s) => (
            <li key={s}>
              <span className="sw" style={{ background: AVAILABILITY[s].color }} aria-hidden />
              {AVAILABILITY[s].label}
            </li>
          ))}
          <li>
            <span className="sw" style={{ background: SAMPLE_STATUS.color }} aria-hidden />
            {SAMPLE_STATUS.label} (בדויה, ללא פניות)
          </li>
          <li>
            <span className="sw dashed" aria-hidden /> גבול גג להמחשה (לא מדידה)
          </li>
          <li>
            <span className="sw solid" aria-hidden /> גבול ששורטט ע״י המפרסם
          </li>
          <li className="legend-note">הופעה במפה אינה מעידה שהגג זמין לעסקה.</li>
        </ul>
      )}
    </div>
  );
}
