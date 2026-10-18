import Link from 'next/link';

export default function InquiryNotFound() {
  return (
    <div className="page narrow empty-page">
      <h1>הפנייה לא נמצאה</h1>
      <p className="muted">ייתכן שהקישור שגוי, שהמודעה נמחקה, או שאין לך גישה לשיחה הזו.</p>
      <Link className="btn primary" href="/dashboard">
        לאזור האישי
      </Link>
    </div>
  );
}
