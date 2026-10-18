/**
 * Operator details shown on /terms, /privacy and /about — the one place to fill
 * in before a public launch. Bracketed values are placeholders: they render
 * highlighted, and placeholder e-mail addresses render without a mailto link.
 */
export const OPERATOR = {
  name: '[שם החברה/המפעיל]',
  companyId: '[מספר ח.פ./ע.מ.]',
  address: '[כתובת למשלוח דואר]',
  contactEmail: '[contact@...]',
  privacyEmail: '[privacy@...]',
  jurisdiction: '[מחוז]',
} as const;

/** Date of the current legal drafts (shown on /terms and /privacy). */
export const LEGAL_DRAFT_DATE = '18 באוקטובר 2026';

const isPlaceholder = (value: string) => value.startsWith('[');

/** Operator detail, highlighted while it is still a placeholder. */
export function Fill({ value }: { value: string }) {
  return isPlaceholder(value) ? <mark className="ph">{value}</mark> : <>{value}</>;
}

export function EmailLink({ value }: { value: string }) {
  if (isPlaceholder(value)) {
    return (
      <mark className="ph" dir="ltr">
        {value}
      </mark>
    );
  }
  return (
    <a href={`mailto:${value}`} dir="ltr">
      {value}
    </a>
  );
}
