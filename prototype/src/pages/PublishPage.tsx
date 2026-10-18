import { Check, ChevronLeft, ChevronRight, Crosshair, ImagePlus, Loader2, PenLine, Search, Trash2, Undo2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DrawMap, type DrawMode } from '../components/DrawMap';
import { newId } from '../data/repository';
import { polygonAreaSqm, polygonCentroid } from '../geo';
import { AGREEMENT_HINT, AGREEMENT_LABEL, AREA_SOURCE_LABEL, AVAILABILITY, BUILDING_LABEL, fmtSqm, REGION_LABEL } from '../labels';
import { href, navigate } from '../router';
import { useStore } from '../store';
import type { AgreementModel, AreaSource, Availability, BuildingType, LatLng, Listing, Region } from '../types';

const STEPS = ['בעלים ומבנה', 'מיקום וגבולות', 'פרטים ותמונות', 'הסכם ופרסום'];
const MAX_IMAGES = 4;

interface Draft {
  ownerName: string;
  ownerContact: string;
  title: string;
  buildingType: BuildingType;
  locality: string;
  region: Region;
  description: string;
  location: LatLng | null;
  polygon: LatLng[];
  areaMode: 'polygon' | 'manual';
  manualArea: string;
  manualSource: Exclude<AreaSource, 'polygon'>;
  usablePct: number;
  roofType: string;
  shading: string;
  grid: string;
  roofAge: string;
  images: string[];
  agreement: AgreementModel;
  rent: string;
  share: string;
  years: string;
  termsNotes: string;
  availability: Availability;
  declared: boolean;
}

const INITIAL: Draft = {
  ownerName: '',
  ownerContact: '',
  title: '',
  buildingType: 'warehouse',
  locality: '',
  region: 'center',
  description: '',
  location: null,
  polygon: [],
  areaMode: 'polygon',
  manualArea: '',
  manualSource: 'manual_estimate',
  usablePct: 65,
  roofType: '',
  shading: '',
  grid: '',
  roofAge: '',
  images: [],
  agreement: 'revenue_share',
  rent: '',
  share: '12',
  years: '20',
  termsNotes: '',
  availability: 'available',
  declared: false,
};

/** Downscale uploads so several fit in localStorage. */
function compressImage(file: File, maxSide = 1100, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function PublishPage() {
  const { addListing, toast, setRole } = useStore();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<DrawMode>('locate');
  const [flyTo, setFlyTo] = useState<{ at: LatLng; key: number } | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchMsg, setSearchMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const polyArea = useMemo(() => polygonAreaSqm(d.polygon), [d.polygon]);
  const totalArea = d.areaMode === 'polygon' ? polyArea : Number(d.manualArea) || 0;
  const usableArea = Math.round((totalArea * d.usablePct) / 100);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchMsg('');
    setResults([]);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=il&accept-language=he&limit=5&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GeoResult[];
      setResults(data);
      if (!data.length) setSearchMsg('לא נמצאו תוצאות. אפשר לבחור מיקום ידנית בלחיצה על המפה.');
    } catch {
      setSearchMsg('חיפוש הכתובות אינו זמין כרגע. אפשר להמשיך ולבחור מיקום ידנית בלחיצה על המפה.');
    } finally {
      clearTimeout(timer);
      setSearching(false);
    }
  };

  const pickResult = (r: GeoResult) => {
    const at: LatLng = [Number(r.lat), Number(r.lon)];
    set('location', at);
    setFlyTo({ at, key: Date.now() });
    setResults([]);
    setSearchMsg(`נבחר: ${r.display_name}. ניתן לגרור את הסמן לדיוק.`);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_IMAGES - d.images.length;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (!list.length) return;
    setUploading(true);
    try {
      const out = await Promise.all(list.map((f) => compressImage(f)));
      setD((p) => ({ ...p, images: [...p.images, ...out].slice(0, MAX_IMAGES) }));
    } catch {
      toast('לא ניתן לקרוא אחת התמונות', 'error');
    } finally {
      setUploading(false);
    }
  };

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (d.ownerName.trim().length < 2) e.ownerName = 'נא להזין שם';
      if (d.ownerContact.trim().length < 5) e.ownerContact = 'נא להזין טלפון או דוא״ל';
      if (d.title.trim().length < 4) e.title = 'נא לתת כותרת קצרה למודעה';
      if (d.locality.trim().length < 2) e.locality = 'נא להזין יישוב';
    }
    if (s === 1) {
      if (!d.location && d.polygon.length < 3) e.location = 'נא לסמן את מיקום המבנה על המפה (או לשרטט את הגג)';
      if (d.areaMode === 'polygon' && d.polygon.length < 3) e.area = 'נא לשרטט לפחות 3 נקודות, או לעבור להזנת שטח ידנית';
      if (d.areaMode === 'manual' && !(Number(d.manualArea) > 0)) e.area = 'נא להזין שטח גג במ״ר';
      if (totalArea > 0 && totalArea < 50) e.area = 'השטח קטן מדי לגג מסחרי (פחות מ-50 מ״ר)';
    }
    if (s === 3) {
      if (!d.declared) e.declared = 'יש לאשר את ההצהרה כדי לפרסם';
      if (d.agreement === 'fixed_rent' && !(Number(d.rent) > 0)) e.rent = 'נא להזין שכירות מבוקשת';
      if (d.agreement === 'revenue_share' && !(Number(d.share) > 0 && Number(d.share) < 100)) e.share = 'נא להזין אחוז בין 1 ל-99';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publish = () => {
    if (!validate(3)) return;
    const center = d.polygon.length >= 3 ? polygonCentroid(d.polygon) : (d.location as LatLng);
    const tech = {
      roofType: d.roofType.trim() || null,
      shading: d.shading.trim() || null,
      grid: d.grid.trim() || null,
      roofAgeYears: d.roofAge ? Number(d.roofAge) : null,
    };
    const listing: Listing = {
      id: newId('roof'),
      title: d.title.trim(),
      locality: d.locality.trim(),
      region: d.region,
      buildingType: d.buildingType,
      center: d.location ?? center,
      polygon: d.areaMode === 'polygon' ? d.polygon : d.polygon.length >= 3 ? d.polygon : [],
      polygonIllustrative: false,
      totalAreaSqm: Math.round(totalArea),
      usableAreaSqm: usableArea,
      areaSource: d.areaMode === 'polygon' ? 'polygon' : d.manualSource,
      availability: d.availability,
      agreement: d.agreement,
      terms: {
        rentPerSqmYear: d.agreement === 'fixed_rent' ? Number(d.rent) : undefined,
        sharePct: d.agreement === 'revenue_share' ? Number(d.share) : undefined,
        years: Number(d.years) || undefined,
        notes: d.termsNotes.trim(),
      },
      description: d.description.trim() || 'לא נוסף תיאור.',
      ownerName: d.ownerName.trim(),
      ownerVerification: 'self_declared',
      techAssessment: Object.values(tech).some((v) => v !== null) ? 'owner_reported' : 'not_assessed',
      tech,
      images: d.images,
      createdAt: new Date().toISOString(),
      isMine: true,
      isFictional: false,
    };
    const ok = addListing(listing);
    if (!ok) {
      toast('האחסון המקומי מלא — נסו להסיר תמונות ולפרסם שוב', 'error');
      return;
    }
    setRole('owner');
    toast('המודעה פורסמה בדמו ונשמרה בדפדפן');
    navigate(href.listing(listing.id));
  };

  return (
    <div className="page publish-page">
      <div className="publish-head">
        <h1>פרסום גג</h1>
        <p className="muted">ארבעה שלבים קצרים. בדמו, המודעה נשמרת בדפדפן שלך בלבד.</p>
      </div>

      <ol className="stepper" aria-label="שלבי הפרסום">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <button onClick={() => i < step && setStep(i)} disabled={i > step} aria-current={i === step ? 'step' : undefined}>
              <span className="num">{i < step ? <Check size={14} /> : i + 1}</span>
              <span className="lbl">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card-surface step-body">
        {step === 0 && (
          <div className="form-grid">
            <label className="field">
              <span>שם בעלי הגג / מורשה</span>
              <input value={d.ownerName} onChange={(e) => set('ownerName', e.target.value)} aria-invalid={!!errors.ownerName} />
              {errors.ownerName && <small className="err">{errors.ownerName}</small>}
            </label>
            <label className="field">
              <span>טלפון או דוא״ל ליצירת קשר</span>
              <input value={d.ownerContact} onChange={(e) => set('ownerContact', e.target.value)} dir="ltr" aria-invalid={!!errors.ownerContact} />
              {errors.ownerContact && <small className="err">{errors.ownerContact}</small>}
            </label>
            <label className="field span2">
              <span>כותרת המודעה</span>
              <input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="לדוגמה: גג מחסן 4,000 מ״ר באזור תעשייה" aria-invalid={!!errors.title} />
              {errors.title && <small className="err">{errors.title}</small>}
            </label>
            <label className="field">
              <span>סוג מבנה</span>
              <select value={d.buildingType} onChange={(e) => set('buildingType', e.target.value as BuildingType)}>
                {(Object.keys(BUILDING_LABEL) as BuildingType[]).map((t) => (
                  <option key={t} value={t}>
                    {BUILDING_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>אזור</span>
              <select value={d.region} onChange={(e) => set('region', e.target.value as Region)}>
                {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field span2">
              <span>יישוב</span>
              <input value={d.locality} onChange={(e) => set('locality', e.target.value)} aria-invalid={!!errors.locality} />
              {errors.locality && <small className="err">{errors.locality}</small>}
            </label>
            <label className="field span2">
              <span>תיאור קצר מהבעלים</span>
              <textarea rows={3} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="מה חשוב שמשקיע ידע על הגג והמבנה?" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="locate-step">
            <div className="locate-tools">
              <div className="search-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
                  placeholder="חיפוש כתובת או יישוב (OpenStreetMap)"
                  aria-label="חיפוש כתובת"
                />
                <button className="btn ghost" onClick={search} disabled={searching}>
                  {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />} חיפוש
                </button>
              </div>
              {results.length > 0 && (
                <ul className="geo-results">
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lon}`}>
                      <button onClick={() => pickResult(r)}>{r.display_name}</button>
                    </li>
                  ))}
                </ul>
              )}
              {searchMsg && <p className="hint">{searchMsg}</p>}

              <div className="seg" role="radiogroup" aria-label="מצב עבודה במפה">
                <button role="radio" aria-checked={mode === 'locate'} className={mode === 'locate' ? 'on' : ''} onClick={() => setMode('locate')}>
                  <Crosshair size={15} /> סימון מיקום
                </button>
                <button role="radio" aria-checked={mode === 'draw'} className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>
                  <PenLine size={15} /> שרטוט גבולות הגג
                </button>
              </div>
              <p className="hint">
                {mode === 'locate'
                  ? 'לחצו על המפה כדי לסמן את המבנה. הסמן ניתן לגרירה.'
                  : 'לחצו על פינות הגג לפי הסדר. גררו נקודה כדי לערוך, לחיצה ימנית מוחקת נקודה. מומלץ לעבוד על "תצלום אוויר".'}
              </p>
              {errors.location && <small className="err">{errors.location}</small>}
            </div>

            <DrawMap
              mode={mode}
              location={d.location}
              polygon={d.polygon}
              flyTo={flyTo}
              onLocation={(p) => set('location', p)}
              onPolygon={(p) => set('polygon', p)}
            />

            <div className="draw-actions">
              <span className="pts">{d.polygon.length} נקודות</span>
              <button className="btn ghost sm" disabled={!d.polygon.length} onClick={() => set('polygon', d.polygon.slice(0, -1))}>
                <Undo2 size={14} /> בטל נקודה
              </button>
              <button className="btn ghost sm" disabled={!d.polygon.length} onClick={() => set('polygon', [])}>
                <Trash2 size={14} /> נקה שרטוט
              </button>
            </div>

            <div className="area-box">
              <div className="seg" role="radiogroup" aria-label="מקור שטח הגג">
                <button role="radio" aria-checked={d.areaMode === 'polygon'} className={d.areaMode === 'polygon' ? 'on' : ''} onClick={() => set('areaMode', 'polygon')}>
                  שטח מהשרטוט
                </button>
                <button role="radio" aria-checked={d.areaMode === 'manual'} className={d.areaMode === 'manual' ? 'on' : ''} onClick={() => set('areaMode', 'manual')}>
                  הזנה ידנית
                </button>
              </div>
              {d.areaMode === 'polygon' ? (
                <div className="area-readout">
                  <span className="k">שטח מחושב (גיאודזי, Turf.js)</span>
                  <span className="v">{d.polygon.length >= 3 ? fmtSqm(polyArea) : '—'}</span>
                  <small className="muted">השרטוט הוא הערכה של המפרסם ואינו מדידה מוסמכת.</small>
                </div>
              ) : (
                <div className="form-grid">
                  <label className="field">
                    <span>שטח גג כולל (מ״ר)</span>
                    <input type="number" min={0} value={d.manualArea} onChange={(e) => set('manualArea', e.target.value)} />
                  </label>
                  <label className="field">
                    <span>מקור הנתון</span>
                    <select value={d.manualSource} onChange={(e) => set('manualSource', e.target.value as Draft['manualSource'])}>
                      <option value="manual_measured">{AREA_SOURCE_LABEL.manual_measured}</option>
                      <option value="manual_estimate">{AREA_SOURCE_LABEL.manual_estimate}</option>
                    </select>
                  </label>
                  {d.polygon.length >= 3 && <small className="muted span2">לשם השוואה, שטח השרטוט: {fmtSqm(polyArea)}</small>}
                </div>
              )}
              <label className="field">
                <span>
                  שטח שמיש להתקנה: {d.usablePct}% ≈ <b>{fmtSqm(usableArea)}</b>
                </span>
                <input type="range" min={20} max={95} value={d.usablePct} onChange={(e) => set('usablePct', Number(e.target.value))} />
                <small className="hint">בניכוי מעברים, מערכות על הגג ושוליים. הערכה בלבד.</small>
              </label>
              {errors.area && <small className="err">{errors.area}</small>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <p className="hint span2">אפשר להשאיר ריק — במודעה יוצג „לא הוערך״.</p>
            <label className="field">
              <span>סוג גג</span>
              <input list="roof-types" value={d.roofType} onChange={(e) => set('roofType', e.target.value)} placeholder="לא הוערך" />
              <datalist id="roof-types">
                <option value="פאנל סנדוויץ׳" />
                <option value="איסכורית" />
                <option value="בטון" />
                <option value="פלדה" />
              </datalist>
            </label>
            <label className="field">
              <span>גיל הגג (שנים)</span>
              <input type="number" min={0} value={d.roofAge} onChange={(e) => set('roofAge', e.target.value)} placeholder="לא ידוע" />
            </label>
            <label className="field">
              <span>הצללה</span>
              <input value={d.shading} onChange={(e) => set('shading', e.target.value)} placeholder="לא הוערך" />
            </label>
            <label className="field">
              <span>חיבור חשמל</span>
              <input value={d.grid} onChange={(e) => set('grid', e.target.value)} placeholder="לא נבדק" />
            </label>
            <div className="field span2">
              <span>תמונות של המבנה והגג (עד {MAX_IMAGES})</span>
              <div className="uploader">
                {d.images.map((src, i) => (
                  <div className="up-thumb" key={i}>
                    <img src={src} alt={`תמונה ${i + 1}`} />
                    <button className="icon-btn" aria-label="הסר תמונה" onClick={() => set('images', d.images.filter((_, j) => j !== i))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {d.images.length < MAX_IMAGES && (
                  <label className="up-add">
                    {uploading ? <Loader2 className="spin" /> : <ImagePlus />}
                    <span>הוספת תמונות</span>
                    <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} hidden />
                  </label>
                )}
              </div>
              <small className="hint">התמונות מוקטנות ונשמרות בדפדפן בלבד.</small>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <div className="field span2">
              <span>מודל התקשרות מוצע</span>
              <div className="agree-opts">
                {(Object.keys(AGREEMENT_LABEL) as AgreementModel[]).map((a) => (
                  <label key={a} className={`agree-opt${d.agreement === a ? ' on' : ''}`}>
                    <input type="radio" name="agreement" checked={d.agreement === a} onChange={() => set('agreement', a)} />
                    <b>{AGREEMENT_LABEL[a]}</b>
                    <small>{AGREEMENT_HINT[a]}</small>
                  </label>
                ))}
              </div>
            </div>
            {d.agreement === 'fixed_rent' && (
              <label className="field">
                <span>שכירות מבוקשת (₪ למ״ר שמיש לשנה)</span>
                <input type="number" min={0} value={d.rent} onChange={(e) => set('rent', e.target.value)} aria-invalid={!!errors.rent} />
                {errors.rent && <small className="err">{errors.rent}</small>}
              </label>
            )}
            {d.agreement === 'revenue_share' && (
              <label className="field">
                <span>חלק מבוקש לבעלים (% מהתזרים לחלוקה)</span>
                <input type="number" min={1} max={99} value={d.share} onChange={(e) => set('share', e.target.value)} aria-invalid={!!errors.share} />
                {errors.share && <small className="err">{errors.share}</small>}
              </label>
            )}
            <label className="field">
              <span>תקופת התקשרות מבוקשת (שנים)</span>
              <input type="number" min={1} max={40} value={d.years} onChange={(e) => set('years', e.target.value)} />
            </label>
            <label className="field">
              <span>סטטוס זמינות</span>
              <select value={d.availability} onChange={(e) => set('availability', e.target.value as Availability)}>
                {(Object.keys(AVAILABILITY) as Availability[]).map((a) => (
                  <option key={a} value={a}>
                    {AVAILABILITY[a].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field span2">
              <span>תנאים נוספים</span>
              <textarea rows={2} value={d.termsNotes} onChange={(e) => set('termsNotes', e.target.value)} placeholder="לדוגמה: הצמדה למדד, חלונות זמן להתקנה" />
            </label>

            <div className="summary span2">
              <b>סיכום:</b> {d.title || 'ללא כותרת'} · {d.locality || '—'} · {BUILDING_LABEL[d.buildingType]} · גג {fmtSqm(totalArea)} · שמיש ≈ {fmtSqm(usableArea)}
            </div>

            <label className={`declare span2${errors.declared ? ' invalid' : ''}`}>
              <input type="checkbox" checked={d.declared} onChange={(e) => set('declared', e.target.checked)} />
              <span>
                אני מצהיר/ה כי אני הבעלים של המבנה או מורשה כדין להציע את הגג להתקשרות, וכי הפרטים שמסרתי נכונים למיטב ידיעתי. ידוע לי שהפלטפורמה לא אימתה את הבעלות ולא ביצעה בדיקה הנדסית.
              </span>
            </label>
            {errors.declared && <small className="err span2">{errors.declared}</small>}
          </div>
        )}
      </div>

      <div className="wizard-nav">
        {step > 0 ? (
          <button className="btn ghost" onClick={() => setStep((s) => s - 1)}>
            <ChevronRight size={16} /> הקודם
          </button>
        ) : (
          <a className="btn ghost" href={href.explore()}>
            ביטול
          </a>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={next}>
            הבא <ChevronLeft size={16} />
          </button>
        ) : (
          <button className="btn accent" onClick={publish}>
            <Check size={16} /> פרסום המודעה (דמו)
          </button>
        )}
      </div>
    </div>
  );
}
