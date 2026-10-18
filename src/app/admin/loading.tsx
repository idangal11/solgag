import { LoaderCircle } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="admin-loading" role="status">
      <LoaderCircle size={18} className="spin" aria-hidden /> טוען נתונים…
    </div>
  );
}
