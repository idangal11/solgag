import { KeyRound, LogOut, Sparkles, Trash2, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/auth/AccountForm';
import { DeleteAccountForm } from '@/components/auth/DeleteAccountForm';
import { safeNextPath } from '@/components/auth/paths';
import { getMyProfile } from '@/lib/data/queries';
import { fmtDate } from '@/lib/labels';
import { getCurrentUser } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import '@/styles/auth.css';

export const metadata: Metadata = {
  title: 'החשבון שלי',
  robots: { index: false, follow: false },
};

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="btn ghost sm">
        <LogOut size={15} aria-hidden /> יציאה מהחשבון
      </button>
    </form>
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Faccount');

  const welcome = params.welcome === '1';
  const next = safeNextPath(params.next);
  // The profile row is created by a database trigger at sign-up; fall back to defaults if it is missing.
  const profile: Profile = (await getMyProfile()) ?? {
    id: user.id,
    fullName: '',
    phone: null,
    contactEmail: user.email ?? null,
    role: 'investor',
    isAdmin: false,
  };

  return (
    <div className="page narrow account-page">
      <header className="account-head">
        <h1>{welcome ? 'ברוכים הבאים לסולגג' : 'החשבון שלי'}</h1>
        <p className="muted">{welcome ? 'עוד צעד קטן ואתם בפנים.' : 'פרטים אישיים, פרטי התחברות וניהול החשבון.'}</p>
      </header>

      <div className="account-stack">
        {welcome && (
          <div className="welcome-note" role="note">
            <Sparkles size={18} aria-hidden />
            <p>
              <b>כמעט סיימנו.</b> איך לקרוא לכם, ובשביל מה תשתמשו בעיקר בסולגג? אפשר לשנות את הפרטים בכל עת בעמוד
              &quot;החשבון שלי&quot;.
            </p>
          </div>
        )}

        <section className="card-surface" aria-labelledby="profile-title">
          <h2 id="profile-title">
            <UserRound size={18} aria-hidden /> פרטים אישיים
          </h2>
          <AccountForm profile={profile} welcome={welcome} next={next} />
        </section>

        <section className="card-surface" aria-labelledby="login-title">
          <h2 id="login-title">
            <KeyRound size={18} aria-hidden /> פרטי התחברות
          </h2>
          <dl className="kv-list">
            {user.email && (
              <div>
                <dt>דוא״ל</dt>
                <dd>
                  <bdi dir="ltr">{user.email}</bdi>
                </dd>
              </div>
            )}
            {user.phone && (
              <div>
                <dt>טלפון להתחברות</dt>
                <dd>
                  <bdi dir="ltr">+{user.phone.replace(/^\+/, '')}</bdi>
                </dd>
              </div>
            )}
            <div>
              <dt>חשבון נפתח</dt>
              <dd>{fmtDate(user.created_at)}</dd>
            </div>
          </dl>
          <p className="hint">הכניסה לסולגג היא בקוד חד־פעמי שנשלח אליכם, ללא סיסמה.</p>
          <div className="form-actions">
            <SignOutButton />
          </div>
        </section>

        {!welcome && (
          <details className="card-surface danger-zone">
            <summary>
              <h2>
                <Trash2 size={18} aria-hidden /> מחיקת חשבון
              </h2>
            </summary>
            <p className="danger-text">
              המחיקה סופית ואי אפשר לבטל אותה. יימחקו הפרופיל, המודעות שפרסמתם, התמונות ומסמכי הבעלות שהעליתם, המועדפים,
              והפניות שנשלחו או התקבלו יחד עם ההודעות בהן.
            </p>
            <DeleteAccountForm />
          </details>
        )}
      </div>
    </div>
  );
}
