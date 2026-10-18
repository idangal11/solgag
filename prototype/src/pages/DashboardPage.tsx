import { Briefcase, Heart, Home, Inbox, MessageSquarePlus, PlusCircle, Send } from 'lucide-react';
import { ListingCard } from '../components/ListingCard';
import { fmtNum } from '../labels';
import { href, navigate } from '../router';
import { useStore } from '../store';
import type { Inquiry } from '../types';

const SAMPLE_SENDERS = [
  { name: 'משקיע לדוגמה א׳ (בדוי)', contact: 'investor-a@example.com', msg: 'מעוניינים לבחון את הגג להתקנה במודל חלוקת הכנסות. אפשר לתאם ביקור?' },
  { name: 'יזם סולארי לדוגמה (בדוי)', contact: '050-0000000', msg: 'נשמח לקבל תשריט של המבנה ונתוני חיבור החשמל.' },
];

function InquiryRow({ i }: { i: Inquiry }) {
  return (
    <li className="inq-row">
      <div className="inq-top">
        <b>{i.direction === 'sent' ? `אל: ${i.listingTitle}` : `מאת: ${i.name}`}</b>
        <time>{new Date(i.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</time>
      </div>
      {i.direction === 'received' && <span className="muted small">על המודעה: {i.listingTitle}</span>}
      <p>{i.message}</p>
      <div className="inq-foot">
        <span className="muted small" dir="ltr">{i.contact}</span>
        <span className="tag tone-muted">{i.direction === 'sent' ? 'נשמר בדמו — לא נשלח' : 'פנייה מדומה לדמו'}</span>
        <a className="btn link sm" href={href.listing(i.listingId)}>
          למודעה
        </a>
      </div>
    </li>
  );
}

export function DashboardPage() {
  const { role, setRole, listings, favorites, inquiries, addInquiry, toast } = useStore();
  const mine = listings.filter((l) => l.isMine);
  const mineIds = new Set(mine.map((l) => l.id));
  const received = inquiries.filter((i) => mineIds.has(i.listingId) && (i.direction === 'received' || i.direction === 'sent'));
  const sent = inquiries.filter((i) => i.direction === 'sent');
  const favListings = listings.filter((l) => favorites.includes(l.id));

  const simulate = () => {
    const l = mine[0];
    if (!l) return;
    const s = SAMPLE_SENDERS[received.length % SAMPLE_SENDERS.length];
    addInquiry({ listingId: l.id, listingTitle: l.title, name: s.name, contact: s.contact, role: 'investor', message: s.msg, direction: 'received' });
    toast('נוספה פנייה מדומה לצורך הדגמה', 'info');
  };

  return (
    <div className="page dashboard">
      <div className="dash-head">
        <div>
          <h1>האזור האישי</h1>
          <p className="muted">ללא הרשמה — מתג תפקיד לצורכי הדגמה. הנתונים נשמרים בדפדפן זה בלבד.</p>
        </div>
        <div className="seg big" role="radiogroup" aria-label="תפקיד בדמו">
          <button role="radio" aria-checked={role === 'owner'} className={role === 'owner' ? 'on' : ''} onClick={() => setRole('owner')}>
            <Home size={16} /> בעלי גג
          </button>
          <button role="radio" aria-checked={role === 'investor'} className={role === 'investor' ? 'on' : ''} onClick={() => setRole('investor')}>
            <Briefcase size={16} /> משקיע/ה
          </button>
        </div>
      </div>

      {role === 'owner' ? (
        <>
          <div className="kpi-strip">
            <div className="kpi">
              <span className="k">המודעות שלי</span>
              <span className="v">{mine.length}</span>
            </div>
            <div className="kpi">
              <span className="k">פניות שהתקבלו</span>
              <span className="v">{received.length}</span>
            </div>
            <div className="kpi">
              <span className="k">סה״כ שטח שמיש</span>
              <span className="v">{fmtNum(mine.reduce((s, l) => s + l.usableAreaSqm, 0))} מ״ר</span>
            </div>
          </div>
          <section className="dash-section">
            <div className="section-head">
              <h2>
                <Home size={18} /> המודעות שלי
              </h2>
              <a className="btn primary sm" href={href.publish()}>
                <PlusCircle size={15} /> פרסום גג חדש
              </a>
            </div>
            {mine.length ? (
              <div className="grid-cards">
                {mine.map((l) => (
                  <ListingCard key={l.id} listing={l} onFocus={(id) => navigate(href.explore(id))} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <p>עוד לא פרסמת גג. זה לוקח כ-2 דקות.</p>
                <a className="btn primary sm" href={href.publish()}>
                  פרסום גג
                </a>
              </div>
            )}
          </section>
          <section className="dash-section">
            <div className="section-head">
              <h2>
                <Inbox size={18} /> פניות שהתקבלו
              </h2>
              {mine.length > 0 && (
                <button className="btn ghost sm" onClick={simulate}>
                  <MessageSquarePlus size={15} /> הדמיית פנייה נכנסת
                </button>
              )}
            </div>
            {received.length ? (
              <ul className="inq-list">
                {received.map((i) => (
                  <InquiryRow key={i.id} i={i} />
                ))}
              </ul>
            ) : (
              <div className="empty">
                <p>{mine.length ? 'אין עדיין פניות. בדמו אין משקיעים אמיתיים — אפשר להדמות פנייה נכנסת.' : 'פניות על המודעות שלך יופיעו כאן.'}</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="kpi-strip">
            <div className="kpi">
              <span className="k">גגות במועדפים</span>
              <span className="v">{favListings.length}</span>
            </div>
            <div className="kpi">
              <span className="k">פניות ששמרתי</span>
              <span className="v">{sent.length}</span>
            </div>
            <div className="kpi">
              <span className="k">שטח שמיש במועדפים</span>
              <span className="v">{fmtNum(favListings.reduce((s, l) => s + l.usableAreaSqm, 0))} מ״ר</span>
            </div>
          </div>
          <section className="dash-section">
            <div className="section-head">
              <h2>
                <Heart size={18} /> מועדפים
              </h2>
            </div>
            {favListings.length ? (
              <div className="grid-cards">
                {favListings.map((l) => (
                  <ListingCard key={l.id} listing={l} onFocus={(id) => navigate(href.explore(id))} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <p>לחצו על ♡ בכרטיס גג כדי לשמור אותו כאן.</p>
                <a className="btn primary sm" href={href.explore()}>
                  לחיפוש גגות
                </a>
              </div>
            )}
          </section>
          <section className="dash-section">
            <div className="section-head">
              <h2>
                <Send size={18} /> פניות ששמרתי
              </h2>
            </div>
            {sent.length ? (
              <ul className="inq-list">
                {sent.map((i) => (
                  <InquiryRow key={i.id} i={i} />
                ))}
              </ul>
            ) : (
              <div className="empty">
                <p>עוד לא השארת פנייה. פתחו מודעה ולחצו „אני מתעניין/ת״.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
