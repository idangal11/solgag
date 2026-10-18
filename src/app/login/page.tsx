import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNextPath, welcomePath } from '@/components/auth/paths';
import { publicConfig } from '@/lib/config';
import { getMyProfile } from '@/lib/data/queries';
import { getCurrentUser } from '@/lib/supabase/server';
import '@/styles/auth.css';

export const metadata: Metadata = {
  title: 'כניסה',
  description: 'כניסה והרשמה לסולגג עם קוד חד־פעמי, בלי סיסמה.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  if (await getCurrentUser()) {
    const profile = await getMyProfile();
    redirect(profile && !profile.fullName.trim() ? welcomePath(next) : next);
  }

  return (
    <div className="auth-page">
      <LoginForm next={next} phoneEnabled={publicConfig.phoneAuthEnabled} linkError={params.error === '1'} />
    </div>
  );
}
