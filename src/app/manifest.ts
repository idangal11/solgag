import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: `${SITE_TAGLINE} — מפה ולוח מודעות שמחברים בין בעלי גגות גדולים בישראל לבין משקיעים במערכות סולאריות.`,
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0f3d2e',
    background_color: '#f6f7f3',
    categories: ['business'],
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
