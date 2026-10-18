import type {
  AgreementModel,
  AreaSource,
  Availability,
  BuildingType,
  OwnerVerification,
  Region,
  TechAssessment,
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
  in_talks: { label: 'בשיחות מתקדמות', color: '#e0a100', desc: 'הבעלים בשיחות עם גורם אחר — ניתן להשאיר פנייה' },
  unavailable: { label: 'לא זמין כרגע', color: '#8a9690', desc: 'מוצג לצורך מידע בלבד, אינו פתוח לעסקה' },
};

export const VERIFICATION: Record<OwnerVerification, { label: string; tone: 'muted' | 'warn' | 'info' }> = {
  not_verified: { label: 'בעלות לא אומתה', tone: 'muted' },
  pending: { label: 'ממתין לאימות בעלות', tone: 'warn' },
  self_declared: { label: 'הצהרת המפרסם בלבד (לא אומת)', tone: 'info' },
};

export const TECH_ASSESSMENT: Record<TechAssessment, { label: string; tone: 'muted' | 'warn' | 'info' }> = {
  not_assessed: { label: 'לא נבדקה התאמה טכנית', tone: 'muted' },
  owner_reported: { label: 'נתונים לפי דיווח הבעלים', tone: 'info' },
  survey_planned: { label: 'סקר הנדסי טרם בוצע', tone: 'warn' },
};

export const AREA_SOURCE_LABEL: Record<AreaSource, string> = {
  polygon: 'חושב משרטוט פוליגון על המפה (Turf.js)',
  manual_measured: 'הוזן ידנית — לפי מדידה / תשריט',
  manual_estimate: 'הוזן ידנית — הערכה של המפרסם',
};

export const NOT_ASSESSED = 'לא הוערך';

export const fmtNum = (n: number, digits = 0) =>
  new Intl.NumberFormat('he-IL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const fmtILS = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

export const fmtSqm = (n: number) => `${fmtNum(Math.round(n))} מ״ר`;
