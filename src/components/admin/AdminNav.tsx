'use client';

import { FileSearch, LayoutDashboard, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav({ pendingCount }: { pendingCount: number | null }) {
  const pathname = usePathname() || '/admin';
  const links = [
    { href: '/admin', label: 'סקירה', icon: <LayoutDashboard size={16} />, badge: 0 },
    { href: '/admin/verification', label: 'אימות בעלות', icon: <FileSearch size={16} />, badge: pendingCount ?? 0 },
    { href: '/admin/listings', label: 'ניהול מודעות', icon: <ListChecks size={16} />, badge: 0 },
  ];

  return (
    <nav className="admin-nav" aria-label="ניווט באזור הניהול">
      {links.map((l) => {
        const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>
            {l.icon}
            <span>{l.label}</span>
            {l.badge > 0 && (
              <span className="admin-count">
                {l.badge}
                <span className="sr-only"> ממתינות</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
