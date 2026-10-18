import { KeyRound } from 'lucide-react';

const GRANT_SQL = `update public.profiles set is_admin = true
where id = (select id from auth.users where email = '...');`;

/** Footer note for the operator: admin rights are granted in the database only. */
export function OperatorNote() {
  return (
    <aside className="admin-operator" aria-labelledby="admin-operator-title">
      <h2 id="admin-operator-title">
        <KeyRound size={16} aria-hidden /> איך מוסיפים מנהל/ת?
      </h2>
      <p>
        הרשאת ניהול ניתנת רק במסד הנתונים. המשתמש/ת צריך/ה להתחבר לאתר פעם אחת (כדי שייווצר פרופיל), ואז מריצים ב-Supabase ←
        SQL Editor, עם כתובת הדוא״ל של החשבון:
      </p>
      <pre dir="ltr">
        <code>{GRANT_SQL}</code>
      </pre>
      <p className="hint">
        להסרת ההרשאה מריצים את אותה פקודה עם <code dir="ltr">is_admin = false</code>. ההרשאות נאכפות במסד הנתונים (RLS), לא רק בממשק.
      </p>
    </aside>
  );
}
