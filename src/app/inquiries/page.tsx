import { redirect } from 'next/navigation';

/** Inquiry lists live in the dashboard; /inquiries only hosts individual threads. */
export default function InquiriesIndex() {
  redirect('/dashboard');
}
