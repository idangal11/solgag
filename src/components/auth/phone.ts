/**
 * Normalises a phone number for SMS sign-in to E.164. Accepts Israeli mobile
 * numbers as people usually type them (050-1234567, 972501234567, +972 50…)
 * and other numbers already in international "+" form. Returns null if invalid.
 */
export function toE164(input: string): string | null {
  const s = input.replace(/[\s\-().‎‏]/g, '');
  const il = /^(?:0|\+?9720?)(5\d{8})$/.exec(s);
  if (il) return `+972${il[1]}`;
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  return null;
}
