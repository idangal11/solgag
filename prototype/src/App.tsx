import { Calculator as CalcIcon, CheckCircle2, Info, LayoutDashboard, Map as MapIcon, PlusCircle, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Calculator } from './components/Calculator';
import { Logo } from './components/Logo';
import { DashboardPage } from './pages/DashboardPage';
import { ExplorePage } from './pages/ExplorePage';
import { ListingPage } from './pages/ListingPage';
import { PublishPage } from './pages/PublishPage';
import { href, useRoute } from './router';
import { useStore } from './store';

function CalculatorPage() {
  const [area, setArea] = useState(3000);
  return (
    <div className="page narrow">
      <h1>מחשבון חלוקת הכנסות</h1>
      <p className="muted">בדקו תרחיש לגג כלשהו. הכניסו שטח שמיש כדי לקבל הנחות התחלתיות, ואז ערכו כל נתון.</p>
      <label className="field inline-field">
        <span>שטח שמיש (מ״ר)</span>
        <input type="number" min={50} step={100} value={area} onChange={(e) => setArea(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <Calculator key={area} usableAreaSqm={area} />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const { role, toasts, resetDemo } = useStore();

  useEffect(() => {
    if (route.name !== 'explore') window.scrollTo(0, 0);
  }, [route]);

  const nav = [
    { name: 'explore', label: 'חיפוש גגות', icon: <MapIcon size={18} />, to: href.explore() },
    { name: 'publish', label: 'פרסום גג', icon: <PlusCircle size={18} />, to: href.publish() },
    { name: 'calculator', label: 'מחשבון', icon: <CalcIcon size={18} />, to: href.calculator() },
    { name: 'dashboard', label: 'אזור אישי', icon: <LayoutDashboard size={18} />, to: href.dashboard() },
  ];
  const activeNav = route.name === 'listing' ? 'explore' : route.name;

  return (
    <div className={`app route-${route.name}`}>
      <header className="topbar">
        <a className="brand" href={href.explore()} aria-label="סולגג — לדף הבית">
          <Logo />
          <span className="brand-text">
            <b>סולגג</b>
            <small>גגות × משקיעים בסולארי</small>
          </span>
        </a>
        <nav className="mainnav" aria-label="ניווט ראשי">
          {nav.map((n) => (
            <a key={n.name} href={n.to} className={activeNav === n.name ? 'active' : ''} aria-current={activeNav === n.name ? 'page' : undefined}>
              {n.icon}
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="topbar-end">
          <a className="role-pill" href={href.dashboard()} title="מתג תפקיד באזור האישי">
            {role === 'owner' ? 'בעלי גג' : 'משקיע/ה'} · דמו
          </a>
        </div>
      </header>

      <div className="demo-banner" role="note">
        <Info size={14} />
        <span>
          <span className="banner-long">אב-טיפוס להדגמה: מודעות הדמו בדויות, אין אימות בעלות או בדיקה הנדסית, ושום פנייה לא נשלחת. הנתונים נשמרים בדפדפן בלבד.</span>
          <span className="banner-short" hidden>
            דמו: מודעות בדויות, ללא אימות, פניות לא נשלחות.
          </span>
        </span>
        <button
          className="btn link xs"
          onClick={() => {
            if (confirm('לאפס את כל נתוני הדמו (מודעות שפרסמת, מועדפים ופניות)?')) resetDemo();
          }}
        >
          <RotateCcw size={13} /> איפוס דמו
        </button>
      </div>

      <main className="main">
        {route.name === 'explore' && <ExplorePage focus={route.focus} />}
        {route.name === 'listing' && <ListingPage id={route.id} />}
        {route.name === 'publish' && <PublishPage />}
        {route.name === 'calculator' && <CalculatorPage />}
        {route.name === 'dashboard' && <DashboardPage />}
      </main>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
