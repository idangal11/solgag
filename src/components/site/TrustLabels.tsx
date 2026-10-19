import { StatusBadge, Tag } from '@/components/ui';
import { AVAILABILITY, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { Availability, OwnerVerification, TechAssessment } from '@/lib/types';

const TECH_DESC: Record<TechAssessment, string> = {
  not_assessed: 'לא בוצעה בדיקה טכנית של הגג. פרטים טכניים במודעה, אם יש, נמסרו על ידי הבעלים.',
  owner_reported: 'הנתונים הטכניים במודעה (כמו סוג הגג, הצללה וחיבור לרשת) נמסרו על ידי הבעלים ולא נבדקו.',
  survey_planned: 'נקבע סקר הנדסי, אבל הוא עדיין לא בוצע ואין ממצאים.',
  assessed: 'צוות הפלטפורמה סימן שבוצע סקר טכני. בקשו את ממצאי הסקר ובחנו אותם עם איש מקצוע מטעמכם.',
};

/** What an owner's edit does to a badge staff gave (mirrors the listings_guard DB trigger). */
const OWNERSHIP_RESET = 'שינוי של מיקום המבנה, גבולות הגג, היישוב או שם המפרסם מבטל את סימון הבדיקה, ובקשה שממתינה לבדיקה נסגרת.';
const TECH_RESET = `כשהבעלים משנים את המיקום, את השטח או את הנתונים הטכניים, „${TECH_ASSESSMENT.assessed.label}״ ו„${TECH_ASSESSMENT.survey_planned.label}״ חוזרים ל„${TECH_ASSESSMENT.owner_reported.label}״.`;

/** Explains every trust label a listing can carry, using the same texts as the listings themselves. */
export function TrustLabels() {
  return (
    <div className="trust-grid">
      <section className="card-surface" aria-labelledby="tl-owner">
        <h3 id="tl-owner">בעלות על הגג</h3>
        <dl className="label-list">
          {(Object.keys(VERIFICATION) as OwnerVerification[]).map((k) => (
            <div key={k}>
              <dt>
                <Tag tone={VERIFICATION[k].tone}>{VERIFICATION[k].label}</Tag>
              </dt>
              <dd>{VERIFICATION[k].desc}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">{OWNERSHIP_RESET}</p>
      </section>

      <section className="card-surface" aria-labelledby="tl-tech">
        <h3 id="tl-tech">התאמה טכנית</h3>
        <dl className="label-list">
          {(Object.keys(TECH_ASSESSMENT) as TechAssessment[]).map((k) => (
            <div key={k}>
              <dt>
                <Tag tone={TECH_ASSESSMENT[k].tone}>{TECH_ASSESSMENT[k].label}</Tag>
              </dt>
              <dd>{TECH_DESC[k]}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">{TECH_RESET}</p>
      </section>

      <section className="card-surface" aria-labelledby="tl-availability">
        <h3 id="tl-availability">זמינות</h3>
        <dl className="label-list">
          {(Object.keys(AVAILABILITY) as Availability[]).map((k) => (
            <div key={k}>
              <dt>
                <StatusBadge status={k} />
              </dt>
              <dd>{AVAILABILITY[k].desc}</dd>
            </div>
          ))}
          <div>
            <dt>
              <StatusBadge status="available" fictional />
            </dt>
            <dd>מוצג במקום סטטוס הזמינות במודעות לדוגמה (בדויות). אי אפשר לשלוח אליהן פנייה.</dd>
          </div>
        </dl>
      </section>

      <section className="card-surface" aria-labelledby="tl-map">
        <h3 id="tl-map">מודעות וגבולות על המפה</h3>
        <dl className="label-list">
          <div>
            <dt>
              <span className="ribbon-sample">מודעה לדוגמה — בדויה</span>
            </dt>
            <dd>מודעה להדגמה בלבד. היא אינה מייצגת מבנה אמיתי, ואי אפשר לשלוח אליה פנייה.</dd>
          </div>
          <div>
            <dt>
              <span className="line-sample solid" aria-hidden /> גבול ששורטט ע״י המפרסם
            </dt>
            <dd>שרטוט של המפרסם על גבי המפה. השטח מחושב ממנו, אבל הוא אינו מדידה.</dd>
          </div>
          <div>
            <dt>
              <span className="line-sample dashed" aria-hidden /> גבול להמחשה בלבד
            </dt>
            <dd>אינו גבול של מבנה אמיתי ואינו מדידה.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
