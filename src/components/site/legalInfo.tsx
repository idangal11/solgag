import { publicConfig } from '@/lib/config';

/**
 * Every operator detail and legal-review item shown on /terms, /privacy and
 * /about. This is the ONE place to fill in before a public launch: the pages
 * contain no other placeholders.
 *
 * To fill in:
 *  1. Replace each `pending('…')` with the real value as a plain string, e.g.
 *     `contactEmail: 'hello@example.co.il'`. Values in HOSTING must match the
 *     production Supabase / Vercel project settings.
 *  2. Only after a lawyer has reviewed /terms and /privacy: set
 *     `LEGAL_STATUS.reviewed = true` and `LEGAL_STATUS.date` to the effective
 *     date. Until then the draft banner and the review notes stay on the pages.
 *
 * A pending value renders as a highlighted "[יושלם לפני ההשקה: …]" marker, and
 * a pending e-mail address renders without a mailto link. `pendingLegalItems()`
 * lists what is still missing; production servers log that list once.
 */

/** A value the operator has not supplied yet. */
export interface Pending {
  readonly pending: string;
}
export type Detail = string | Pending;

const pending = (label: string): Pending => ({ pending: label });

export const isPending = (value: Detail | null | undefined): value is Pending => typeof value === 'object' && value !== null;

/** Who operates the service: the Privacy Protection Law s.11 notice, the terms and the contact details. */
export const OPERATOR: {
  /** Legal name of the operating company or person. */
  name: Detail;
  /** Company / business registration number. */
  companyId: Detail;
  /** Postal address. */
  address: Detail;
  /** Questions, reports of problematic listings, and the fallback for account deletion. */
  contactEmail: Detail;
  /** Privacy requests (access, correction, deletion). May be the same address as contactEmail. */
  privacyEmail: Detail;
  /** District whose courts have jurisdiction (terms, "דין וסמכות שיפוט"). */
  jurisdiction: Detail;
  /** Privacy officer, if one must be appointed under the law. Set to null when none is appointed. */
  privacyOfficer: Detail | null;
} = {
  name: pending('שם החברה או המפעיל'),
  companyId: pending('מספר ח.פ. או ע.מ.'),
  address: pending('כתובת למשלוח דואר'),
  contactEmail: pending('כתובת דוא״ל לפניות'),
  privacyEmail: pending('כתובת דוא״ל לפניות בנושא פרטיות'),
  jurisdiction: pending('מחוז השיפוט'),
  privacyOfficer: pending('שם ופרטי קשר של ממונה הגנת הפרטיות, אם מונה'),
};

/** Production facts the code cannot see. Take them from the Supabase and Vercel project settings. */
export const HOSTING: {
  supabaseRegion: Detail;
  vercelRegion: Detail;
  /** Login codes are sent by Supabase Auth through the SMTP server configured in the Supabase project. */
  loginEmailProvider: Detail;
  /** Only shown (and only required) when phone sign-in is enabled (NEXT_PUBLIC_AUTH_PHONE_ENABLED=true). */
  smsProvider: Detail;
  /** How long Vercel and Supabase keep request/error logs, e.g. 'עד 7 ימים'. */
  logRetention: Detail;
  /** How long database backups are kept, e.g. 'עד 7 ימים'. */
  backupRetention: Detail;
} = {
  supabaseRegion: pending('אזור הפרויקט ב-Supabase, למשל פרנקפורט, גרמניה'),
  vercelRegion: pending('אזור העיבוד ב-Vercel, למשל פרנקפורט, גרמניה'),
  loginEmailProvider: pending('ספק הדוא״ל של קודי הכניסה'),
  smsProvider: pending('ספק המסרונים של קודי הכניסה'),
  logRetention: pending('משך שמירת יומני המערכת'),
  backupRetention: pending('משך שמירת הגיבויים'),
};

export const LEGAL_STATUS = {
  /** true only after a lawyer has reviewed /terms and /privacy. */
  reviewed: false,
  /** Date of the current text: the draft date, or the effective date once reviewed. */
  date: '19 באוקטובר 2026',
};

/** Points the lawyer must decide. Each one is highlighted on its page until LEGAL_STATUS.reviewed. */
export const REVIEW_NOTES = {
  transferBasis: 'בסיס ההעברה לחו״ל לכל ספק',
  rightsResponseTime: 'המועד למענה לבקשות לפי החוק והתקנות',
  liabilityCap: 'היקף הגבלת האחריות ותקרה כספית, לאור חוק החוזים האחידים ודיני הגנת הצרכן',
} as const;

/** Operator and hosting details still missing, as Hebrew labels. */
export function pendingDetails(): string[] {
  const details: (Detail | null)[] = [
    ...Object.values(OPERATOR),
    HOSTING.supabaseRegion,
    HOSTING.vercelRegion,
    HOSTING.loginEmailProvider,
    publicConfig.phoneAuthEnabled ? HOSTING.smsProvider : null,
    HOSTING.logRetention,
    HOSTING.backupRetention,
  ];
  return details.filter(isPending).map((d) => d.pending);
}

/** Everything still missing before launch, details and legal review (empty when ready). */
export function pendingLegalItems(): string[] {
  const missing = pendingDetails();
  if (!LEGAL_STATUS.reviewed) missing.push('בדיקה משפטית של תנאי השימוש ומדיניות הפרטיות', ...Object.values(REVIEW_NOTES));
  return missing;
}

/** Whether the user-facing contact addresses exist yet (the pages explain the interim channels when not). */
export const contactEmailsPending = isPending(OPERATOR.contactEmail) || isPending(OPERATOR.privacyEmail);

const TO_BE_FILLED = 'יושלם לפני ההשקה';

/** Operator detail; a pending one renders as a highlighted "to be filled in before launch" marker. */
export function Fill({ value }: { value: Detail }) {
  if (!isPending(value)) return <>{value}</>;
  return (
    <mark className="ph">
      [{TO_BE_FILLED}: {value.pending}]
    </mark>
  );
}

/** E-mail address as a mailto link; a pending one renders as a marker without a link. */
export function EmailLink({ value }: { value: Detail }) {
  if (isPending(value)) return <Fill value={value} />;
  return (
    <a href={`mailto:${value}`} dir="ltr">
      {value}
    </a>
  );
}

/**
 * A point for the lawyer, highlighted until the legal review is done; then it
 * renders nothing. It brings its own leading space, so place it right after the
 * preceding word, with no space in between.
 */
export function ReviewNote({ children }: { children: string }) {
  if (LEGAL_STATUS.reviewed) return null;
  return (
    <>
      {' '}
      <mark className="ph">[לבדיקה משפטית: {children}]</mark>
    </>
  );
}

// A loud reminder in production server logs (when this module first loads) while
// anything is missing. Deliberately not a build failure: local, CI and staging
// builds must keep working.
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  const missing = pendingLegalItems();
  if (missing.length) {
    console.warn(
      `[legal] /terms, /privacy and /about are not launch-ready: ${missing.length} item(s) pending in src/components/site/legalInfo.tsx — ${missing.join(' | ')}`,
    );
  }
}
