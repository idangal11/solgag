import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { contactEmailsPending, LEGAL_STATUS, pendingDetails } from './legalInfo';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Says exactly what is unfinished: the legal review, missing operator details, and the interim contact route. */
function DraftNote() {
  const detailsMissing = pendingDetails().length > 0;
  if (LEGAL_STATUS.reviewed && !detailsMissing) return null;

  return (
    <div className="draft-note" role="note" aria-labelledby="draft-note-title">
      <TriangleAlert size={20} aria-hidden />
      <div>
        <strong id="draft-note-title">
          {LEGAL_STATUS.reviewed ? 'חסרים פרטים במסמך' : 'טיוטה — הנוסח טרם נבדק על ידי עורך/ת דין'}
        </strong>
        {!LEGAL_STATUS.reviewed && (
          <p>
            המסמך מתאר את אופן הפעולה הנוכחי של השירות, אבל הוא עוד לא עבר בדיקה משפטית, והנוסח עשוי להשתנות לפני ההשקה הציבורית. נקודות שממתינות להחלטה
            משפטית מסומנות כך: <mark className="ph">[לבדיקה משפטית: …]</mark>.
          </p>
        )}
        {detailsMissing && (
          <p>
            פרטים שהמפעיל טרם מסר מסומנים כך: <mark className="ph">[יושלם לפני ההשקה: …]</mark>, והם יושלמו לפני ההשקה הציבורית.
            {contactEmailsPending && (
              <>
                {' '}
                עד שתוגדר כתובת דוא״ל לפניות, אפשר לעדכן את הפרטים ולמחוק את החשבון בעצמכם בעמוד <Link href="/account">החשבון שלי</Link>, ולהסתיר או
                למחוק מודעות <Link href="/dashboard">באזור האישי</Link>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Shared frame for the legal texts: status note, table of contents, numbered sections. */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="page narrow legal-page" aria-labelledby="legal-title">
      <header className="legal-head">
        <h1 id="legal-title">{title}</h1>
        <DraftNote />
        <p className="legal-meta">
          {LEGAL_STATUS.reviewed ? 'בתוקף מיום' : 'נוסח טיוטה מיום'} {LEGAL_STATUS.date}
        </p>
        <div className="legal-intro">{intro}</div>
      </header>

      <nav className="legal-toc" aria-labelledby="legal-toc-title">
        <h2 id="legal-toc-title">תוכן העניינים</h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="legal-section" aria-labelledby={`${s.id}-title`}>
          <h2 id={`${s.id}-title`}>
            <span className="num" aria-hidden>
              {i + 1}.
            </span>
            <span>{s.title}</span>
          </h2>
          {s.body}
        </section>
      ))}
    </article>
  );
}
