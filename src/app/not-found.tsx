import { Calculator as CalcIcon, CirclePlus, Info, Map as MapIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/site.css';

export const metadata: Metadata = {
  title: 'הדף לא נמצא',
};

export default function NotFound() {
  return (
    <div className="page narrow sys-page">
      <p className="sys-code" aria-hidden>
        404
      </p>
      <h1>הדף לא נמצא</h1>
      <p className="muted">ייתכן שהקישור שגוי, או שהדף הוסר או הועבר. אפשר להמשיך מכאן:</p>
      <nav className="sys-links" aria-label="קישורים מומלצים">
        <Link className="btn primary" href="/">
          <MapIcon size={17} aria-hidden /> למפת הגגות
        </Link>
        <Link className="btn ghost" href="/publish">
          <CirclePlus size={17} aria-hidden /> פרסום גג
        </Link>
        <Link className="btn ghost" href="/calculator">
          <CalcIcon size={17} aria-hidden /> מחשבון
        </Link>
        <Link className="btn ghost" href="/about">
          <Info size={17} aria-hidden /> אודות
        </Link>
      </nav>
    </div>
  );
}
