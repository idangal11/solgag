import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator as CalcIcon,
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  Heart,
  MapPin,
  Maximize2,
  MessageSquare,
  Plug,
  ShieldQuestion,
  Sun,
  SunDim,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { MapContainer, Marker, Polygon, ZoomControl } from 'react-leaflet';
import { Calculator } from '../components/Calculator';
import { InquiryDialog } from '../components/InquiryDialog';
import { BaseLayers, listingBounds, pinIcon } from '../components/mapParts';
import { FictionalRibbon, ListingImage, StatusBadge, Tag } from '../components/ui';
import {
  AGREEMENT_HINT,
  AGREEMENT_LABEL,
  AREA_SOURCE_LABEL,
  AVAILABILITY,
  BUILDING_LABEL,
  fmtILS,
  fmtNum,
  fmtSqm,
  NOT_ASSESSED,
  REGION_LABEL,
  TECH_ASSESSMENT,
  VERIFICATION,
} from '../labels';
import { href, navigate } from '../router';
import { useStore } from '../store';

export function ListingPage({ id }: { id: string }) {
  const { getListing, favorites, toggleFavorite, deleteListing, toast } = useStore();
  const listing = getListing(id);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  if (!listing) {
    return (
      <div className="page narrow empty-page">
        <h1>המודעה לא נמצאה</h1>
        <p className="muted">ייתכן שנתוני הדמו אופסו.</p>
        <a className="btn primary" href={href.explore()}>
          חזרה למפה
        </a>
      </div>
    );
  }
  const fav = favorites.includes(listing.id);
  const verification = VERIFICATION[listing.ownerVerification];
  const tech = TECH_ASSESSMENT[listing.techAssessment];
  const canInquire = listing.availability !== 'unavailable';
  const t = listing.terms;

  const techRows = [
    { icon: <Warehouse size={16} />, k: 'סוג גג', v: listing.tech.roofType },
    { icon: <SunDim size={16} />, k: 'הצללה', v: listing.tech.shading },
    { icon: <Plug size={16} />, k: 'חיבור חשמל', v: listing.tech.grid },
    { icon: <CalendarDays size={16} />, k: 'גיל הגג', v: listing.tech.roofAgeYears != null ? `${listing.tech.roofAgeYears} שנים (לפי הבעלים)` : null },
  ];

  return (
    <div className="page listing-page">
      <a className="back-link" href={href.explore()}>
        <ArrowRight size={16} /> חזרה לחיפוש
      </a>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="hero-media">
            {listing.images.length ? (
              <img src={listing.images[imgIdx] ?? listing.images[0]} alt={`תמונה של ${listing.title}`} className="hero-img" />
            ) : (
              <ListingImage listing={listing} className="hero-img" />
            )}
            <FictionalRibbon listing={listing} />
            {!listing.images.length && <span className="img-note">איור להמחשה — אין תמונה של המבנה</span>}
            {listing.images.length > 1 && (
              <div className="thumbs">
                {listing.images.map((src, i) => (
                  <button key={i} className={i === imgIdx ? 'on' : ''} onClick={() => setImgIdx(i)} aria-label={`תמונה ${i + 1}`}>
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <header className="detail-head">
            <div className="badges">
              <StatusBadge status={listing.availability} />
              <span className="agreement-chip">{AGREEMENT_LABEL[listing.agreement]}</span>
            </div>
            <h1>{listing.title}</h1>
            <p className="card-meta lg">
              <MapPin size={16} /> {listing.locality}, {REGION_LABEL[listing.region]}
              <span className="sep">·</span>
              <Building2 size={16} /> {BUILDING_LABEL[listing.buildingType]}
            </p>
            <p className="status-desc">{AVAILABILITY[listing.availability].desc}</p>
          </header>

          <div className="stat-grid">
            <div className="stat">
              <Maximize2 size={18} />
              <span className="k">שטח גג כולל</span>
              <span className="v">{fmtSqm(listing.totalAreaSqm)}</span>
            </div>
            <div className="stat accent">
              <Sun size={18} />
              <span className="k">שטח שמיש מוערך להתקנה</span>
              <span className="v">{fmtSqm(listing.usableAreaSqm)}</span>
            </div>
            <div className="stat">
              <ClipboardCheck size={18} />
              <span className="k">מקור המדידה</span>
              <span className="v sm">{AREA_SOURCE_LABEL[listing.areaSource]}</span>
            </div>
          </div>

          <section className="card-surface">
            <h2>
              <FileSignature size={19} /> הצעת ההתקשרות
            </h2>
            <p className="muted">{AGREEMENT_HINT[listing.agreement]}</p>
            <dl className="terms">
              <div>
                <dt>מודל</dt>
                <dd>{AGREEMENT_LABEL[listing.agreement]}</dd>
              </div>
              {t.rentPerSqmYear != null && (
                <div>
                  <dt>שכירות מבוקשת</dt>
                  <dd>
                    {fmtILS(t.rentPerSqmYear)} למ״ר שמיש לשנה
                    <small> (≈ {fmtILS(t.rentPerSqmYear * listing.usableAreaSqm)} בשנה)</small>
                  </dd>
                </div>
              )}
              {t.sharePct != null && (
                <div>
                  <dt>חלק מבוקש לבעלים</dt>
                  <dd>{fmtNum(t.sharePct)}% מהתזרים לחלוקה</dd>
                </div>
              )}
              {t.years != null && (
                <div>
                  <dt>תקופה מבוקשת</dt>
                  <dd>{t.years} שנים</dd>
                </div>
              )}
              {t.notes && (
                <div className="full">
                  <dt>תנאים נוספים</dt>
                  <dd>{t.notes}</dd>
                </div>
              )}
            </dl>
            <h3 className="sub">מהבעלים</h3>
            <blockquote className="owner-quote">
              {listing.description}
              <footer>— {listing.ownerName}</footer>
            </blockquote>
          </section>

          <section className="card-surface">
            <h2>
              <ShieldQuestion size={19} /> אימות והתאמה טכנית
            </h2>
            <div className="verify-grid">
              <div className={`verify tone-${verification.tone}`}>
                <span className="k">אימות בעלות</span>
                <span className="v">{verification.label}</span>
              </div>
              <div className={`verify tone-${tech.tone}`}>
                <span className="k">הערכת התאמה טכנית</span>
                <span className="v">{tech.label}</span>
              </div>
            </div>
            <p className="note">
              <AlertTriangle size={15} /> בפלטפורמה בשלב הדמו לא מבוצע אימות בעלות או בדיקה הנדסית. כל הנתונים הטכניים מוצגים כפי שדווחו או כ״{NOT_ASSESSED}״.
            </p>
            <ul className="tech-list">
              {techRows.map((r) => (
                <li key={r.k}>
                  <span className="k">
                    {r.icon} {r.k}
                  </span>
                  {r.v ? <span className="v">{r.v}</span> : <Tag tone="muted">{NOT_ASSESSED}</Tag>}
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface">
            <h2>
              <MapPin size={19} /> מיקום וגבולות הגג
            </h2>
            <div className="mini-map" dir="ltr">
              <MapContainer bounds={listingBounds(listing)} boundsOptions={{ padding: [40, 40], maxZoom: 18 }} zoomControl={false} scrollWheelZoom={false} className="leaflet-host">
                <BaseLayers defaultAerial />
                <ZoomControl position="topright" />
                {listing.polygon.length >= 3 ? (
                  <Polygon
                    positions={listing.polygon}
                    pathOptions={{ color: '#f5b81c', weight: 3, fillOpacity: 0.2, dashArray: listing.polygonIllustrative ? '7 6' : undefined }}
                  />
                ) : (
                  <Marker position={listing.center} icon={pinIcon(listing.availability)} />
                )}
              </MapContainer>
            </div>
            <p className="note">
              <AlertTriangle size={15} />
              {listing.polygonIllustrative
                ? 'מיקום ופוליגון להמחשה בלבד. הם אינם מייצגים את גבולות מבנה אמיתי כלשהו.'
                : 'הפוליגון שורטט על ידי המפרסם ולא נמדד או אומת.'}
            </p>
            <a className="btn ghost sm" href={href.explore(listing.id)}>
              הצג במפה הראשית
            </a>
          </section>

          <Calculator key={listing.id} usableAreaSqm={listing.usableAreaSqm} ownerSharePct={listing.terms.sharePct} />

          {listing.isMine && (
            <button
              className="btn danger-ghost sm"
              onClick={() => {
                if (confirm('למחוק את המודעה מהדמו?')) {
                  deleteListing(listing.id);
                  toast('המודעה נמחקה מהדמו', 'info');
                  navigate(href.dashboard());
                }
              }}
            >
              <Trash2 size={15} /> מחיקת המודעה שלי
            </button>
          )}
        </div>

        <aside className="detail-aside">
          <div className="action-card">
            <div className="ac-area">
              <span className="k">שטח שמיש מוערך</span>
              <span className="v">{fmtSqm(listing.usableAreaSqm)}</span>
              <span className="muted">מתוך {fmtSqm(listing.totalAreaSqm)} גג</span>
            </div>
            <button className="btn primary block lg" onClick={() => setInquiryOpen(true)} disabled={!canInquire}>
              <MessageSquare size={18} /> אני מתעניין/ת בגג הזה
            </button>
            {!canInquire && <small className="muted center">הגג אינו זמין כרגע לפניות</small>}
            <button className={`btn ghost block${fav ? ' fav-on' : ''}`} onClick={() => toggleFavorite(listing.id)} aria-pressed={fav}>
              <Heart size={17} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'שמור במועדפים' : 'שמירה למועדפים'}
            </button>
            <a className="btn link block" href="#calculator" onClick={(e) => { e.preventDefault(); document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' }); }}>
              <CalcIcon size={16} /> לחישוב פיננסי
            </a>
            <p className="tiny muted">{listing.isFictional ? 'מודעה בדויה. אין מאחוריה בעלים אמיתיים.' : 'מודעה שפורסמה בדפדפן זה בלבד (דמו).'}</p>
          </div>
        </aside>
      </div>

      <div className="mobile-actionbar">
        <button className={`icon-btn lg${fav ? ' fav-on' : ''}`} onClick={() => toggleFavorite(listing.id)} aria-label="מועדפים" aria-pressed={fav}>
          <Heart size={20} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <button className="btn primary block" onClick={() => setInquiryOpen(true)} disabled={!canInquire}>
          <MessageSquare size={17} /> {canInquire ? 'אני מתעניין/ת' : 'לא זמין לפניות'}
        </button>
      </div>

      {inquiryOpen && <InquiryDialog listing={listing} onClose={() => setInquiryOpen(false)} />}
    </div>
  );
}
