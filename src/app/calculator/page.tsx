import { Info, ListChecks, Map as MapIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AreaCalculator } from '@/components/site/AreaCalculator';
import '@/styles/site.css';

export const metadata: Metadata = {
  title: 'מחשבון חלוקת הכנסות',
  description:
    'מחשבון להמחשה של חלוקת התזרים ממערכת סולארית על גג בין בעלי הגג למשקיע — בחלוקת הכנסות או בשכירות קבועה — לפי שטח שמיש והנחות שאתם קובעים. לא תחזית ולא ייעוץ השקעות.',
  alternates: { canonical: '/calculator' },
};

const NOT_COVERED = [
  'זכויות במקרקעין וההסכמות הנדרשות להתקשרות',
  'מצב הגג והקונסטרוקציה — בסקר של מהנדס מוסמך',
  'היתכנות וזמינות של חיבור לרשת החשמל',
  'מסלול מכירת החשמל והתעריף הרלוונטי',
  'היתרים, ביטוח, מימון ומיסוי',
];

export default function CalculatorPage() {
  return (
    <div className="page narrow calc-page">
      <h1>מחשבון חלוקת הכנסות</h1>
      <p className="muted">
        בדקו תרחיש לגג כלשהו: הכניסו שטח שמיש כדי לקבל הנחות התחלתיות, בחרו מודל תשלום לבעלי הגג — חלוקת הכנסות באחוזים או שכירות קבועה — וערכו כל
        נתון.
      </p>

      <AreaCalculator />

      <aside className="card-surface calc-next" aria-labelledby="calc-next-title">
        <h2 id="calc-next-title">
          <ListChecks size={20} aria-hidden /> מה המחשבון לא בודק
        </h2>
        <p className="muted">לפני כל החלטה כדאי לבדוק עם אנשי מקצוע מוסמכים, בין היתר:</p>
        <ul>
          {NOT_COVERED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="note">
          <Info size={15} aria-hidden />
          <span>
            המחשבון אינו ייעוץ השקעות ואינו הצעה להשקיע. מודעה על המפה אינה אומרת שהגג זמין לעסקה — בדקו את סטטוס הזמינות במודעה עצמה.
          </span>
        </p>
        <div className="calc-next-btns">
          <Link className="btn primary" href="/">
            <MapIcon size={17} aria-hidden /> חיפוש גגות על המפה
          </Link>
          <Link className="btn ghost" href="/about">
            איך סולגג עובד
          </Link>
        </div>
      </aside>
    </div>
  );
}
