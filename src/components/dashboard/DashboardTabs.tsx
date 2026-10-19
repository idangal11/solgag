'use client';

import { Briefcase, House } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from 'react';
import { callAction } from '@/app/dashboard/_lib/callAction';
import { setDashboardRole } from '@/app/dashboard/actions';
import { useApp } from '@/components/AppProvider';
import type { UserRole } from '@/lib/types';

const TABS: { key: UserRole; label: string; icon: ReactNode }[] = [
  { key: 'owner', label: 'בעלי גג', icon: <House size={16} aria-hidden /> },
  { key: 'investor', label: 'משקיע/ה', icon: <Briefcase size={16} aria-hidden /> },
];

interface Props {
  initialTab: UserRole;
  name: string | null;
  owner: ReactNode;
  investor: ReactNode;
}

/**
 * Owner / investor views of the dashboard. Switching is instant (both panels are
 * server-rendered), keeps ?tab= in the URL and remembers the choice in profiles.role.
 */
export function DashboardTabs({ initialTab, name, owner, investor }: Props) {
  const { toast } = useApp();
  const [tab, setTab] = useState<UserRole>(initialTab);
  const [, startTransition] = useTransition();
  const buttons = useRef<Partial<Record<UserRole, HTMLButtonElement | null>>>({});

  const select = (next: UserRole) => {
    if (next === tab) return;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    // Only a preference save: the tab has already switched locally, so a lost
    // connection or a stale build is logged quietly and never takes over the page.
    startTransition(async () => {
      const res = await callAction(() => setDashboardRole(next));
      if (!res.ok && res.reason === 'server') toast(res.error, 'error');
    });
  };

  // WAI-ARIA tabs keyboard model; in RTL the left arrow moves forward.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let j: number | null = null;
    if (e.key === 'ArrowLeft') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowRight') j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TABS.length - 1;
    if (j === null) return;
    e.preventDefault();
    const next = TABS[j].key;
    select(next);
    buttons.current[next]?.focus();
  };

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>האזור האישי</h1>
          <p className="muted">
            {name ? (
              <>
                שלום <bdi>{name}</bdi>.{' '}
              </>
            ) : null}
            ניהול המודעות, הפניות והמועדפים שלך. האזור נפתח בתצוגה שבחרת לאחרונה.{' '}
            <Link href="/account">עדכון פרטי החשבון</Link>
          </p>
        </div>
        <div className="seg big" role="tablist" aria-label="תצוגת האזור האישי" onKeyDown={onKeyDown}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  buttons.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`dash-tab-${t.key}`}
                aria-selected={on}
                aria-controls={`dash-panel-${t.key}`}
                tabIndex={on ? 0 : -1}
                className={on ? 'on' : ''}
                onClick={() => select(t.key)}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id="dash-panel-owner" aria-labelledby="dash-tab-owner" hidden={tab !== 'owner'}>
        {owner}
      </div>
      <div role="tabpanel" id="dash-panel-investor" aria-labelledby="dash-tab-investor" hidden={tab !== 'investor'}>
        {investor}
      </div>
    </>
  );
}
