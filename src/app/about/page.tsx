import {
  BadgeCheck,
  Calculator as CalcIcon,
  CircleCheck,
  CirclePlus,
  CircleX,
  Compass,
  Handshake,
  Mail,
  Map as MapIcon,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmailLink, Fill, OPERATOR } from '@/components/site/legalInfo';
import { TrustLabels } from '@/components/site/TrustLabels';
import { AGREEMENT_HINT, AGREEMENT_LABEL, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { AgreementModel } from '@/lib/types';
import '@/styles/site.css';

export const metadata: Metadata = {
  title: 'אודות',
  description:
    'איך סולגג עובד לבעלי גגות ולמשקיעים, אילו מודלי התקשרות מופיעים במודעות, ומה הפלטפורמה עושה ולא עושה — בלי לנחש מה נבדק ומה לא.',
  alternates: { canonical: '/about' },
};

const OWNER_STEPS = [
  'מתחברים בקוד חד־פעמי, בלי סיסמה, ומפרסמים את הגג: מיקום על המפה, שרטוט גבולות הגג או הזנת שטח ידנית, ותמונות.',
  'בוחרים מודל התקשרות מבוקש, ומצהירים שאתם הבעלים או מורשים להציע את הגג.',
  'מקבלים פניות באזור האישי ומשיבים משם. פרטי הקשר שלכם לא מוצגים במודעה.',
  'רוצים לחזק את האמינות? אפשר להגיש מסמך בעלות לבדיקת צוות הפלטפורמה.',
];

const INVESTOR_STEPS = [
  'מחפשים גגות על המפה ומסננים לפי אזור, שטח שמיש, סוג מבנה ומודל התקשרות.',
  'בודקים בכל מודעה את סטטוס הזמינות ואת התוויות: מה נבדק ומה נמסר על ידי הבעלים.',
  'מריצים במחשבון תרחיש של חלוקת הכנסות, לפי הנחות שאתם קובעים.',
  'שולחים פנייה לבעלי הגג וממשיכים את השיחה באזור האישי. הבדיקות וההסכם — ישירות ביניכם.',
];

const DOES = [
  'מציגה על מפה וברשימה מודעות שבעלי גגות פרסמו.',
  'מחשבת את שטח הגג מהשרטוט של המפרסם. השרטוט עצמו אינו מדידה.',
  'מאפשרת לשלוח פניות ולהתכתב, ושולחת התראה בדוא״ל על פנייה או הודעה חדשה.',
  'בודקת מסמכי בעלות או הרשאה כשהבעלים בוחרים להגיש אותם, ומסמנת את התוצאה במודעה.',
  'מסמנת במפורש מודעות לדוגמה (בדויות) וגבולות להמחשה.',
  'מסתירה או מסירה תוכן שמפר את תנאי השימוש.',
];

const DOES_NOT = [
  `לא מאמתת בעלות — אלא אם המודעה מסומנת „${VERIFICATION.verified.label}״ אחרי בדיקת מסמך. גם אז אין בכך אישור משפטי או ערובה.`,
  `לא מבצעת בדיקה הנדסית או סקר טכני — אלא אם המודעה מסומנת „${TECH_ASSESSMENT.assessed.label}״. נתונים טכניים אחרים נמסרו על ידי הבעלים.`,
  'לא נותנת ייעוץ השקעות, ייעוץ משפטי, מיסויי או הנדסי, ולא מציעה ניירות ערך או השקעות.',
  'לא גובה תשלומים, לא מחזיקה כספים ולא מנסחת או חותמת על חוזים בין הצדדים.',
  'לא מתחייבת שגג זמין לעסקה. הופעה על המפה אינה זמינות — בדקו את סטטוס הזמינות ובררו מול הבעלים.',
  'לא מבטיחה חיבור לרשת, היתרים, תעריף או תפוקה.',
];

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="about-steps">
      {items.map((text, i) => (
        <li key={i}>
          <span className="n" aria-hidden>
            {i + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

export default function AboutPage() {
  return (
    <div className="page about-page">
      <header className="about-hero">
        <h1>אודות סולגג</h1>
        <p className="lead">
          סולגג הוא לוח מודעות ומפה שמחברים בין בעלי גגות גדולים בישראל — מחסנים, מפעלים, רפתות ולולים ומבנים מסחריים — לבין משקיעים, יזמים וחברות התקנה
          שמחפשים גגות להקמת מערכות סולאריות.
        </p>
        <p>המטרה: שבעלי גג יציגו את הגג בצורה ברורה, ושמשקיעים ימצאו גגות רלוונטיים ויפנו ישירות — בלי לנחש מה נבדק ומה לא.</p>
      </header>

      <section className="about-section" aria-labelledby="how-title">
        <h2 id="how-title">
          <Compass size={20} aria-hidden /> איך זה עובד
        </h2>
        <div className="about-two">
          <article className="card-surface about-card" aria-labelledby="how-owners">
            <h3 id="how-owners">
              <Warehouse size={20} aria-hidden /> לבעלי גגות
            </h3>
            <Steps items={OWNER_STEPS} />
            <Link className="btn primary" href="/publish">
              <CirclePlus size={17} aria-hidden /> פרסום גג
            </Link>
          </article>
          <article className="card-surface about-card" aria-labelledby="how-investors">
            <h3 id="how-investors">
              <Search size={20} aria-hidden /> למשקיעים, יזמים וחברות התקנה
            </h3>
            <Steps items={INVESTOR_STEPS} />
            <Link className="btn primary" href="/">
              <MapIcon size={17} aria-hidden /> לחיפוש גגות
            </Link>
          </article>
        </div>
      </section>

      <section className="about-section" aria-labelledby="models-title">
        <h2 id="models-title">
          <Handshake size={20} aria-hidden /> מודלי התקשרות במודעות
        </h2>
        <ul className="about-models">
          {(Object.keys(AGREEMENT_LABEL) as AgreementModel[]).map((m) => (
            <li key={m} className="card-surface">
              <span className="agreement-chip">{AGREEMENT_LABEL[m]}</span>
              <p>{AGREEMENT_HINT[m]}</p>
            </li>
          ))}
        </ul>
        <p className="muted about-note">
          המודל שבמודעה משקף את העדפת הבעלים בלבד. התנאים הסופיים נקבעים במשא ומתן ובהסכם בין הצדדים, מחוץ לפלטפורמה.
        </p>
      </section>

      <section className="about-section" aria-labelledby="scope-title">
        <h2 id="scope-title">
          <ShieldCheck size={20} aria-hidden /> מה הפלטפורמה עושה — ומה לא
        </h2>
        <div className="about-two">
          <div className="card-surface scope-card does">
            <h3>הפלטפורמה כן:</h3>
            <ul className="scope-list">
              {DOES.map((t) => (
                <li key={t}>
                  <CircleCheck size={17} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-surface scope-card does-not">
            <h3>הפלטפורמה לא:</h3>
            <ul className="scope-list">
              {DOES_NOT.map((t) => (
                <li key={t}>
                  <CircleX size={17} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="labels-title">
        <h2 id="labels-title">
          <BadgeCheck size={20} aria-hidden /> איך לקרוא את התוויות במודעה
        </h2>
        <p className="muted about-note">כל מודעה מציגה מה נבדק בפועל ומה נמסר על ידי המפרסם. אלה התוויות האפשריות:</p>
        <TrustLabels />
      </section>

      <section className="about-section" aria-labelledby="contact-title">
        <h2 id="contact-title">
          <Mail size={20} aria-hidden /> יצירת קשר
        </h2>
        <div className="card-surface about-contact">
          <p>
            שאלות, דיווח על מודעה בעייתית או בקשה למחיקת חשבון: <EmailLink value={OPERATOR.contactEmail} />
          </p>
          <p>
            בקשות בנושא פרטיות: <EmailLink value={OPERATOR.privacyEmail} />
          </p>
          <p className="muted small">
            השירות מופעל על ידי <Fill value={OPERATOR.name} />. ראו גם <Link href="/terms">תנאי שימוש</Link> ו<Link href="/privacy">מדיניות פרטיות</Link>.
          </p>
        </div>
      </section>

      <section className="about-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">מתחילים?</h2>
        <div className="about-cta-btns">
          <Link className="btn accent" href="/">
            <MapIcon size={17} aria-hidden /> למפת הגגות
          </Link>
          <Link className="btn ghost" href="/publish">
            <CirclePlus size={17} aria-hidden /> פרסום גג
          </Link>
          <Link className="btn ghost" href="/calculator">
            <CalcIcon size={17} aria-hidden /> למחשבון
          </Link>
        </div>
      </section>
    </div>
  );
}
