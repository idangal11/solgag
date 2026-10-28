import { FlaskConical, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { ImportForm } from '@/components/admin/prospects/ImportForm';
import { ProspectsWorkspace } from '@/components/admin/prospects/ProspectsWorkspace';
import { parseProspectFilters } from '@/lib/prospects';
import '@/styles/explore.css';
import '@/styles/prospects.css';
import { getProspectRoofs } from '../_lib/prospects';
import { requireAdmin } from '../_lib/data';

export const metadata: Metadata = { title: 'ניהול — גגות פוטנציאליים (פיילוט)' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AdminProspectsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const [roofs, sp] = await Promise.all([getProspectRoofs(), searchParams]);
  const demoCount = roofs.filter((r) => r.isDemo).length;

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>
            <FlaskConical size={22} aria-hidden /> גגות פוטנציאליים — פיילוט פנימי
          </h1>
          <p className="muted">
            גגות מסחריים גדולים שזוהו מנתוני מבנים פתוחים, והעסקים שמופיעים בכתובת שלהם במקורות ציבוריים. מוצג לצוות בלבד, ולא מופיע במפה
            הציבורית.
          </p>
        </div>
      </div>

      <p className="note admin-guidance">
        <ShieldAlert size={15} aria-hidden />
        <span>
          כל הנתונים כאן טעונים בדיקה. עסק בכתובת עשוי להיות שוכר ואינו „בעל הגג” ללא ראיה. השטח וההספק הם הערכה ראשונית מטביעת הרגל
          של המבנה — לא סקר. פרט קשר שלא נמצא באתר הרשמי מסומן „לא זמין”. אין לשלוח פניות שיווקיות לפני בדיקה משפטית (חוק התקשורת §30א, חוק
          הגנת הפרטיות).
          {demoCount > 0 && ` ${demoCount} רשומות מסומנות כנתוני הדגמה.`}
        </span>
      </p>

      <ImportForm />

      {roofs.length ? (
        <ProspectsWorkspace roofs={roofs} initialFilters={parseProspectFilters(sp)} />
      ) : (
        <div className="empty">
          <p>אין עדיין גגות בפיילוט. ייבאו את קובץ המחקר בעזרת „ייבוא אצווה ממחקר”.</p>
        </div>
      )}
    </>
  );
}
