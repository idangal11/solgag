import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/admin.css';
import { AdminNav } from '@/components/admin/AdminNav';
import { OperatorNote } from '@/components/admin/OperatorNote';
import { getPendingVerificationCount, requireAdmin } from './_lib/data';

export const metadata: Metadata = {
  title: 'ניהול',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const pendingCount = await getPendingVerificationCount();

  return (
    <div className="page admin">
      <div className="admin-bar">
        <span className="admin-kicker">
          <ShieldCheck size={15} aria-hidden /> אזור ניהול
        </span>
        <AdminNav pendingCount={pendingCount} />
      </div>
      {children}
      <OperatorNote />
    </div>
  );
}
