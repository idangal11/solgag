/**
 * Inline field error, linked to its input through aria-describedby (see errProps).
 * Focusable so the wizard can move focus to errors that have no input (map, declaration).
 */
export function FieldError({ id, msg, className = '' }: { id: string; msg?: string; className?: string }) {
  if (!msg) return null;
  return (
    <small id={id} className={`err ${className}`.trim()} tabIndex={-1}>
      {msg}
    </small>
  );
}

/** aria attributes for an input whose error is rendered as <FieldError id={`err-${key}`} />. */
export function errProps(key: string, errors: Record<string, string>) {
  const invalid = !!errors[key];
  return { 'aria-invalid': invalid, 'aria-describedby': invalid ? `err-${key}` : undefined } as const;
}
