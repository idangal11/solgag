// Generates supabase/seed.sql with 12 FICTIONAL demo listings.
// Run: node scripts/generate-demo-seed.mjs
//
// supabase/seed.sql runs only on local `supabase db reset`. It is never pushed
// to production by `supabase db push`. All rows are flagged is_fictional = true,
// cannot receive inquiries (RLS), and are labelled as fictional in the UI.

import area from '@turf/area';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const listings = [
  { title: 'רפת חלב משפחתית בעמק', locality: 'מושב בעמק יזרעאל', region: 'valleys', type: 'dairy', center: [32.6795, 35.1905], shape: { w: 38, l: 120, rot: 28 }, ratio: 0.7, availability: 'available', agreement: 'revenue_share', share: 14, years: 25, notes: 'מעדיפים חלוקת הכנסות; התקנה מחוץ לעונת ההמלטות.', description: 'גג רפת ארוך ופתוח לדרום, בלי מבנים גבוהים בסביבה. מחפשים משקיע לטווח ארוך שידאג גם לתחזוקה.', owner: 'משק משפחתי (שם בדוי)', tech: 'owner_reported', roof: 'פאנל סנדוויץ׳ (לפי הבעלים)', shading: 'ללא הצללה משמעותית (לפי הבעלים)', grid: null, age: 9, days: 3 },
  { title: 'מבנה ייצור באזור תעשייה', locality: 'קריית גת', region: 'south', type: 'factory', center: [31.6185, 34.7905], shape: { w: 70, l: 110, rot: -12, notch: { w: 30, l: 35 } }, ratio: 0.62, availability: 'available', agreement: 'fixed_rent', rent: 18, years: 20, notes: 'שכירות צמודת מדד, תשלום שנתי מראש.', description: 'גג מפעל עם מספר יחידות מיזוג בצד הצפוני. חיבור חשמל תעשייתי קיים במבנה.', owner: 'חברת נכסים (שם בדוי)', tech: 'owner_reported', roof: 'איסכורית מבודדת (לפי הבעלים)', shading: 'הצללה חלקית מיחידות מיזוג', grid: 'חיבור תעשייתי קיים, הספק לא נבדק', age: 14, days: 6 },
  { title: 'מרכז לוגיסטי — גג רחב', locality: 'פארק תעשייה בשפלה', region: 'center', type: 'warehouse', center: [31.9935, 34.9475], shape: { w: 90, l: 160, rot: 5 }, ratio: 0.72, availability: 'in_talks', agreement: 'open', years: 25, notes: 'פתוחים לשכירות או חלוקת הכנסות, בהתאם להצעה.', description: 'מחסן הפצה גדול עם גג שטוח יחסית. כבר מתקיימות שיחות עם גורם אחד, אך נשמח לשמוע הצעות נוספות.', owner: 'בעלי נכס לוגיסטי (שם בדוי)', tech: 'survey_planned', roof: null, shading: null, grid: null, age: null, days: 11 },
  { title: 'מבנה מסחרי עם חניון', locality: 'נתניה', region: 'sharon', type: 'commercial', center: [32.2795, 34.8665], shape: { w: 55, l: 85, rot: 40 }, ratio: 0.55, availability: 'available', agreement: 'revenue_share', share: 18, years: 20, notes: 'דרישה לתיאום מול ועד הבית המסחרי.', description: 'מבנה מסחרי דו-קומתי. חלק מהגג משמש למערכות מיזוג — השטח הפנוי מסומן כשטח שמיש מוערך.', owner: 'הנהלת מבנה (שם בדוי)', tech: 'not_assessed', roof: 'בטון (לפי הבעלים)', shading: null, grid: null, age: null, days: 1 },
  { title: 'מפעל מתכת בגליל', locality: 'כרמיאל', region: 'galilee', type: 'factory', center: [32.9195, 35.3155], shape: { w: 60, l: 95, rot: -30 }, ratio: 0.66, availability: 'available', agreement: 'fixed_rent', rent: 15, years: 25, notes: 'עדיפות למשקיע שיבצע גם חיזוק קונסטרוקציה במידת הצורך.', description: 'גג פלדה בן כ-20 שנה. ייתכן שיידרש חיזוק — לא בוצעה בדיקה קונסטרוקטיבית.', owner: 'מפעל משפחתי (שם בדוי)', tech: 'not_assessed', roof: 'פלדה (לפי הבעלים)', shading: null, grid: 'חיבור 3×250A (לפי הבעלים)', age: 20, days: 9 },
  { title: 'לולי הטלה במושב', locality: 'מושב בעמק חפר', region: 'sharon', type: 'agri', center: [32.3685, 34.9235], shape: { w: 18, l: 105, rot: 72 }, ratio: 0.75, availability: 'available', agreement: 'open', years: 20, notes: 'שני מבנים צמודים; אפשר להתחיל במבנה אחד.', description: 'גגות לולים ארוכים וצרים. מבנה שני צמוד אינו כלול בפוליגון ההמחשה.', owner: 'חקלאי (שם בדוי)', tech: 'owner_reported', roof: 'איסכורית (לפי הבעלים)', shading: 'עצים בצד המזרחי (לפי הבעלים)', grid: null, age: 7, days: 15 },
  { title: 'מחסן קירור ליד הנמל', locality: 'אשדוד', region: 'shfela', type: 'warehouse', center: [31.8095, 34.6615], shape: { w: 75, l: 120, rot: -48 }, ratio: 0.68, availability: 'unavailable', agreement: 'fixed_rent', rent: 20, years: 15, notes: 'הגג אינו זמין כרגע; ייפתח לפניות בעוד כשנה.', description: 'מוצג לצורך מידע בלבד. הבעלים ציינו שהגג אינו פנוי לעסקה כעת.', owner: 'חברת אחסון (שם בדוי)', tech: 'not_assessed', roof: null, shading: null, grid: null, age: null, days: 30 },
  { title: 'בית אריזה חקלאי', locality: 'מושב בערבה התיכונה', region: 'arava', type: 'agri', center: [30.6505, 35.2405], shape: { w: 45, l: 80, rot: 0 }, ratio: 0.74, availability: 'available', agreement: 'revenue_share', share: 12, years: 25, notes: 'קרינה גבוהה באזור; יש לבדוק מגבלות רשת מקומיות.', description: 'מבנה בית אריזה בשטח פתוח. הקרינה באזור גבוהה, אך זמינות החיבור לרשת לא נבדקה.', owner: 'אגודה חקלאית (שם בדוי)', tech: 'owner_reported', roof: 'פאנל סנדוויץ׳ (לפי הבעלים)', shading: 'ללא הצללה (לפי הבעלים)', grid: null, age: 5, days: 4 },
  { title: 'מבנה תעשייה עתירת ידע', locality: 'ירושלים — אזור תעשייה', region: 'jerusalem', type: 'factory', center: [31.7965, 35.2045], shape: { w: 40, l: 65, rot: 18 }, ratio: 0.5, availability: 'in_talks', agreement: 'revenue_share', share: 20, years: 20, notes: 'גג עם מגבלות תכנוניות אפשריות — נדרשת בדיקה.', description: 'גג בטון עם מעקות. שטח שמיש מוערך נמוך בגלל מערכות טכניות על הגג.', owner: 'חברת ניהול (שם בדוי)', tech: 'survey_planned', roof: 'בטון (לפי הבעלים)', shading: null, grid: null, age: 12, days: 20 },
  { title: 'מחסן הפצה במפרץ', locality: 'חיפה — מפרץ', region: 'haifa', type: 'warehouse', center: [32.7985, 35.0615], shape: { w: 65, l: 140, rot: 60 }, ratio: 0.7, availability: 'available', agreement: 'open', years: 20, notes: 'נבחן גם שילוב אגירה — פתוחים לרעיונות.', description: 'מחסן הפצה פעיל. ייתכנו מגבלות גובה ובטיחות באזור — טרם נבדקו.', owner: 'בעלי מחסן (שם בדוי)', tech: 'not_assessed', roof: null, shading: null, grid: null, age: null, days: 2 },
  { title: 'רפת בקיבוץ בנגב', locality: 'קיבוץ בנגב המערבי', region: 'south', type: 'dairy', center: [31.3605, 34.6005], shape: { w: 42, l: 130, rot: -8 }, ratio: 0.71, availability: 'available', agreement: 'revenue_share', share: 15, years: 25, notes: 'נדרש אישור האגודה לפני חתימה.', description: 'שתי סככות רפת מקבילות; פוליגון ההמחשה מציג סככה אחת בלבד.', owner: 'אגודה שיתופית (שם בדוי)', tech: 'owner_reported', roof: 'איסכורית (לפי הבעלים)', shading: 'ללא הצללה (לפי הבעלים)', grid: 'שנאי במשק, הספק פנוי לא ידוע', age: 11, days: 7 },
  { title: 'מרכז מסחרי שכונתי', locality: 'באר שבע', region: 'south', type: 'commercial', center: [31.2485, 34.8095], shape: { w: 50, l: 70, rot: 22, notch: { w: 20, l: 25 } }, ratio: 0.58, availability: 'available', agreement: 'fixed_rent', rent: 22, years: 15, notes: 'שכירות קבועה בלבד.', description: 'מבנה מסחרי בן קומה אחת. גישה לגג דרך חדר מדרגות שירות.', owner: 'בעלי נכס מסחרי (שם בדוי)', tech: 'not_assessed', roof: 'בטון (לפי הבעלים)', shading: null, grid: null, age: null, days: 12 },
];

function footprint([lat0, lng0], { w, l, rot, notch }) {
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const hw = w / 2;
  const hl = l / 2;
  let pts = notch
    ? [[-hw, -hl], [hw, -hl], [hw, hl - notch.l], [hw - notch.w, hl - notch.l], [hw - notch.w, hl], [-hw, hl]]
    : [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
  const r = (rot * Math.PI) / 180;
  pts = pts.map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]);
  return pts.map(([x, y]) => [lng0 + x / mPerLng, lat0 + y / mPerLat]); // [lng, lat]
}

const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);

const rows = listings.map((d) => {
  const ring = footprint(d.center, d.shape);
  const closed = [...ring, ring[0]];
  const total = area({ type: 'Polygon', coordinates: [closed] });
  const usable = Math.round((total * d.ratio) / 10) * 10;
  const wkt = `SRID=4326;POLYGON((${closed.map(([x, y]) => `${x.toFixed(7)} ${y.toFixed(7)}`).join(',')}))`;
  const point = `SRID=4326;POINT(${d.center[1]} ${d.center[0]})`;
  return `(${[
    q(d.title), q(d.locality), `'${d.region}'`, `'${d.type}'`, q(point), q(wkt), 'true',
    Math.round(total), usable, `'polygon'`, `'${d.availability}'`, `'${d.agreement}'`,
    q(d.rent ?? null), q(d.share ?? null), q(d.years ?? null), q(d.notes), q(d.description), q(d.owner),
    `'not_verified'`, `'${d.tech}'`, q(d.roof), q(d.shading), q(d.grid), q(d.age),
    'true', `now() - interval '${d.days} days'`,
  ].join(', ')})`;
});

const sql = `-- GENERATED by scripts/generate-demo-seed.mjs — do not edit by hand.
-- FICTIONAL demo listings for local development (is_fictional = true).
-- Locations are approximate points in real localities; footprints are generated
-- shapes for illustration and do not represent any real building, owner or offer.

insert into public.listings (
  title, locality, region, building_type, location, footprint, polygon_illustrative,
  total_area_sqm, usable_area_sqm, area_source, availability, agreement,
  rent_per_sqm_year, share_pct, term_years, terms_notes, description, owner_display_name,
  owner_verification, tech_assessment, roof_type, shading, grid_connection, roof_age_years,
  is_fictional, created_at
) values
${rows.join(',\n')};
`;

const out = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url));
writeFileSync(out, sql, 'utf8');
console.log(`wrote ${rows.length} fictional listings to ${out}`);
