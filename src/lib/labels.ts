import type {
  AgreementModel,
  AreaSource,
  Availability,
  BuildingType,
  InquiryRole,
  InquiryStatus,
  OwnerVerification,
  Region,
  TechAssessment,
  VerificationStatus,
} from './types';

export const REGION_LABEL: Record<Region, string> = {
  galilee: 'גליל וצפון',
  haifa: 'חיפה והקריות',
  valleys: 'העמקים',
  sharon: 'השרון',
  center: 'מרכז',
  jerusalem: 'ירושלים והסביבה',
  shfela: 'שפלה וחוף דרומי',
  south: 'הנגב',
  arava: 'ערבה ואילת',
};

export const BUILDING_LABEL: Record<BuildingType, string> = {
  warehouse: 'מחסן / לוגיסטיקה',
  factory: 'מפעל',
  dairy: 'רפת / לול',
  commercial: 'מבנה מסחרי',
  agri: 'מבנה חקלאי',
};

export const AGREEMENT_LABEL: Record<AgreementModel, string> = {
  fixed_rent: 'שכירות קבועה',
  revenue_share: 'חלוקת הכנסות',
  open: 'פתוח להצעות',
};

export const AGREEMENT_HINT: Record<AgreementModel, string> = {
  fixed_rent: 'המשקיע משלם לבעלים דמי שכירות שנתיים קבועים עבור הגג',
  revenue_share: 'הבעלים מקבלים אחוז מתזרים המערכת לאחר הוצאות תפעול ורזרבה',
  open: 'הבעלים פתוחים לשמוע הצעות למודל ההתקשרות',
};

export const AVAILABILITY: Record<Availability, { label: string; color: string; desc: string }> = {
  available: { label: 'פתוח לפניות', color: '#1f9d55', desc: 'הבעלים מבקשים לקבל פניות ממשקיעים' },
  in_talks: { label: 'בשיחות מתקדמות', color: '#e0a100', desc: 'הבעלים בשיחות עם גורם אחר — עדיין ניתן להשאיר פנייה' },
  unavailable: { label: 'לא זמין כרגע', color: '#8a9690', desc: 'מוצג לצורך מידע בלבד, אינו פתוח לעסקה' },
};

export type Tone = 'muted' | 'warn' | 'info' | 'ok' | 'bad';

export const VERIFICATION: Record<OwnerVerification, { label: string; tone: Tone; desc: string }> = {
  not_verified: { label: 'בעלות לא אומתה', tone: 'muted', desc: 'המפרסם הצהיר שהוא מורשה להציע את הגג. לא הוגשו מסמכים לבדיקה.' },
  pending: { label: 'מסמכי בעלות בבדיקה', tone: 'warn', desc: 'הוגשו מסמכים והם ממתינים לבדיקת צוות הפלטפורמה.' },
  verified: { label: 'בעלות נבדקה מול מסמכים', tone: 'ok', desc: 'צוות הפלטפורמה בדק מסמך בעלות/הרשאה שהוגש. אין בכך אישור משפטי או ערובה.' },
  rejected: { label: 'אימות הבעלות לא אושר', tone: 'bad', desc: 'המסמכים שהוגשו לא הספיקו לאימות. ניתן להגיש מסמכים חדשים.' },
};

export const TECH_ASSESSMENT: Record<TechAssessment, { label: string; tone: Tone }> = {
  not_assessed: { label: 'לא נבדקה התאמה טכנית', tone: 'muted' },
  owner_reported: { label: 'נתונים לפי דיווח הבעלים', tone: 'info' },
  survey_planned: { label: 'סקר הנדסי מתוכנן — טרם בוצע', tone: 'warn' },
  assessed: { label: 'נבדק בסקר טכני', tone: 'ok' },
};

export const AREA_SOURCE_LABEL: Record<AreaSource, string> = {
  polygon: 'חושב משרטוט גבולות על המפה (PostGIS / Turf.js)',
  manual_measured: 'הוזן ידנית — לפי מדידה / תשריט',
  manual_estimate: 'הוזן ידנית — הערכה של המפרסם',
};

export const INQUIRY_ROLE_LABEL: Record<InquiryRole, string> = {
  investor: 'משקיע/ה',
  installer: 'חברת התקנה / יזם',
  other: 'אחר',
};

export const INQUIRY_STATUS: Record<InquiryStatus, { label: string; tone: Tone }> = {
  new: { label: 'חדשה', tone: 'warn' },
  in_progress: { label: 'בטיפול', tone: 'info' },
  closed: { label: 'סגורה', tone: 'muted' },
};

export const VERIFICATION_REQUEST_STATUS: Record<VerificationStatus, { label: string; tone: Tone }> = {
  pending: { label: 'ממתין לבדיקה', tone: 'warn' },
  approved: { label: 'אושר', tone: 'ok' },
  rejected: { label: 'נדחה', tone: 'bad' },
};

export const NOT_ASSESSED = 'לא הוערך';

export const fmtNum = (n: number, digits = 0) =>
  new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const fmtILS = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

export const fmtSqm = (n: number) => `${fmtNum(Math.round(n))} מ״ר`;

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
