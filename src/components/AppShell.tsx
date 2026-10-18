'use client';

import { Calculator as CalcIcon, Info, LayoutDashboard, LogIn, Map as MapIcon, PlusCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useApp } from './AppProvider';
import { Logo } from './Logo';

function routeName(pathname: string): string {
  if (pathname === '/') return 'explore';
  return pathname.split('/')[1] || 'explore';
}

export function AppShell({ children, year }: { children: ReactNode; year: number }) {
  const pathname = usePathname() || '/';
  const { user } = useApp();
  const route = routeName(pathname);

  const nav = [
    { key: 'explore', label: 'חיפוש גגות', icon: <MapIcon size={18} />, href: '/', match: ['explore', 'listing'] },
    { key: 'publish', label: 'פרסום גג', icon: <PlusCircle size={18} />, href: '/publish', match: ['publish'] },
    { key: 'calculator', label: 'מחשבון', icon: <CalcIcon size={18} />, href: '/calculator', match: ['calculator'] },
    { key: 'dashboard', label: 'אזור אישי', icon: <LayoutDashboard size={18} />, href: '/dashboard', match: ['dashboard', 'inquiries', 'account'] },
  ];
  if (user?.isAdmin) nav.push({ key: 'admin', label: 'ניהול', icon: <ShieldCheck size={18} />, href: '/admin', match: ['admin'] });

  return (
    <div className={`app route-${route}`}>
      <a className="skip-link" href="#main">
        דילוג לתוכן
      </a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="סולגג — לדף הבית">
          <Logo />
          <span className="brand-text">
            <b>סולגג</b>
            <small>גגות × משקיעים בסולארי</small>
          </span>
        </Link>
        <nav className="mainnav" aria-label="ניווט ראשי">
          {nav.map((n) => {
            const active = n.match.includes(route);
            return (
              <Link key={n.key} href={n.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                {n.icon}
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="topbar-end user-menu">
          {user ? (
            <Link className="avatar" href="/account" title={`החשבון שלי — ${user.displayName}`} aria-label="החשבון שלי">
              {(user.displayName.trim()[0] || '?').toUpperCase()}
            </Link>
          ) : (
            <Link className="btn ghost sm" href={`/login?next=${encodeURIComponent(pathname)}`} aria-label="כניסה או הרשמה">
              <LogIn size={15} aria-hidden="true" /> <span className="label">כניסה</span>
            </Link>
          )}
        </div>
      </header>

      <div className="demo-banner" role="note">
        <Info size={14} />
        <span>
          <span className="banner-long">
            גרסת בטא: פרטי המודעות נמסרים על ידי המפרסמים. אין לראות בהם בדיקה הנדסית, ייעוץ או הצעת השקעה.
          </span>
          <span className="banner-short" hidden>
            בטא: המידע נמסר ע״י המפרסמים ואינו ייעוץ.
          </span>
        </span>
      </div>

      <main className="main" id="main">
        {children}
      </main>

      <footer className="site-footer">
        <div className="inner">
          <span>© {year} סולגג · המחשבון והמידע להמחשה בלבד ואינם ייעוץ השקעות.</span>
          <nav aria-label="קישורים משפטיים">
            <Link href="/terms">תנאי שימוש</Link>
            <Link href="/privacy">מדיניות פרטיות</Link>
            <Link href="/about">אודות</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
