import { Mail, Phone } from 'lucide-react';

/** Sender contact as a mailto:/tel: link. Rendered LTR so numbers and addresses read correctly. */
export function ContactLink({ contact }: { contact: string }) {
  const isEmail = contact.includes('@');
  const href = isEmail ? `mailto:${contact}` : `tel:${contact.replace(/[^\d+]/g, '')}`;
  return (
    <a className="dash-contact" href={href} dir="ltr">
      {isEmail ? <Mail size={14} aria-hidden /> : <Phone size={14} aria-hidden />}
      <span>{contact}</span>
    </a>
  );
}
