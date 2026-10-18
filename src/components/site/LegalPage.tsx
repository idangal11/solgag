import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { LEGAL_DRAFT_DATE } from './legalInfo';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared frame for the legal drafts: draft warning, table of contents, numbered sections. */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="page narrow legal-page" aria-labelledby="legal-title">
      <header className="legal-head">
        <h1 id="legal-title">{title}</h1>
        <div className="draft-note" role="note">
          <TriangleAlert size={20} aria-hidden />
          <div>
            <strong>טיוטה — יש לבדוק עם עורך/ת דין לפני השקה ציבורית</strong>
            <p>
              זהו נוסח עבודה שטרם נבדק משפטית. פרטים בסוגריים מרובעים, כמו <mark className="ph">[שם החברה/המפעיל]</mark>,
              ממתינים להשלמה.
            </p>
          </div>
        </div>
        <p className="legal-meta">נוסח טיוטה מיום {LEGAL_DRAFT_DATE}</p>
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
