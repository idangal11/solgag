import { Mail, Phone } from 'lucide-react';

// The contact string is typed by the inquirer (and can be inserted through the
// API without the form's validation), so it is never pasted into an href as is:
// a value like "me@x.co?bcc=…&body=…" would add recipients or text to the
// owner's reply. Only a plain address or phone number becomes a link.
// No ? & = % # / \ quotes, spaces or control characters can pass these patterns.
const EMAIL = /^([A-Za-z0-9._+-]{1,64})@([A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24})$/;
const PHONE = /^\+?[0-9\- ]{9,15}$/;

/** mailto:/tel: href for a well-formed contact, or null when it should stay plain text. */
export function contactHref(raw: string): string | null {
  const contact = raw.trim();
  const email = EMAIL.exec(contact);
  if (email) {
    // Encode each part anyway (a no-op for validated input except "+"), so the
    // href can never carry URL syntax; keep "@" literal for picky mail handlers.
    const [, local, domain] = email;
    return `mailto:${encodeURIComponent(local).replace(/%2B/g, '+')}@${encodeURIComponent(domain)}`;
  }
  if (PHONE.test(contact)) {
    const digits = contact.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return null;
    return `tel:${contact.startsWith('+') ? '+' : ''}${digits}`;
  }
  return null;
}

/** Sender contact as a mailto:/tel: link (plain text when malformed). Rendered LTR so numbers and addresses read correctly. */
export function ContactLink({ contact }: { contact: string }) {
  const value = contact.trim();
  const href = contactHref(value);
  const isEmail = value.includes('@');
  const icon = isEmail ? <Mail size={14} aria-hidden /> : <Phone size={14} aria-hidden />;
  if (!href) {
    return (
      <span className="dash-contact is-plain" dir="ltr">
        {icon}
        <bdi>{value}</bdi>
      </span>
    );
  }
  return (
    <a className="dash-contact" href={href} dir="ltr">
      {icon}
      <span>{value}</span>
    </a>
  );
}
