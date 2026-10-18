import { Map as MapIcon } from 'lucide-react';
import Link from 'next/link';

export default function ListingNotFound() {
  return (
    <div className="page narrow empty-page">
      <h1>המודעה לא נמצאה</h1>
      <p className="muted">
        ייתכן שהמודעה הוסרה או הוסתרה על ידי המפרסם, או שהקישור שגוי. אם זו מודעה מוסתרת שלך — יש להתחבר כדי לצפות בה.
      </p>
      <Link className="btn primary" href="/">
        <MapIcon size={17} aria-hidden="true" /> חזרה למפת הגגות
      </Link>
    </div>
  );
}
