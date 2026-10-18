import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AppProvider, type SessionUser } from '@/components/AppProvider';
import { AppShell } from '@/components/AppShell';
import { publicConfig, SITE_NAME, SITE_TAGLINE } from '@/lib/config';
import { getMyFavoriteIds, getMyProfile } from '@/lib/data/queries';
import { getCurrentUser } from '@/lib/supabase/server';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-heebo', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.siteUrl),
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: 'פלטפורמה שמחברת בין בעלי גגות גדולים — מחסנים, מפעלים, רפתות ומבנים מסחריים — לבין משקיעים במערכות סולאריות בישראל.',
  applicationName: SITE_NAME,
  openGraph: { type: 'website', locale: 'he_IL', siteName: SITE_NAME },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0f3d2e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getCurrentUser();
  const [profile, favoriteIds] = authUser ? await Promise.all([getMyProfile(), getMyFavoriteIds()]) : [null, []];
  const sessionUser: SessionUser | null = authUser
    ? {
        id: authUser.id,
        displayName: profile?.fullName || authUser.email || authUser.phone || 'משתמש',
        isAdmin: profile?.isAdmin ?? false,
      }
    : null;

  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>
        <AppProvider user={sessionUser} initialFavorites={favoriteIds}>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
