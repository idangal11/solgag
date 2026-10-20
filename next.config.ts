import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Refuse to ship production with the free keyless tile servers: neither
// tile.openstreetmap.org nor Esri's keyless World Imagery is licensed for
// commercial traffic (docs/DEPLOY.md §3). Mirrors src/lib/config.ts.
if (process.env.VERCEL_ENV === 'production' && process.env.ALLOW_KEYLESS_TILES !== 'true') {
  const street = process.env.NEXT_PUBLIC_MAP_TILE_URL || (process.env.NEXT_PUBLIC_MAPTILER_KEY ? 'maptiler' : '');
  const imagery = process.env.NEXT_PUBLIC_IMAGERY_TILE_URL || (process.env.NEXT_PUBLIC_ESRI_API_KEY ? 'esri' : '');
  const keyless = (u: string) => !u || /tile\.openstreetmap\.org|arcgisonline\.com/.test(u);
  const missing = [keyless(street) && 'NEXT_PUBLIC_MAPTILER_KEY', keyless(imagery) && 'NEXT_PUBLIC_ESRI_API_KEY'].filter(Boolean);
  if (missing.length) {
    throw new Error(`Production build refused: licensed map tiles are not configured (${missing.join(', ')}). See docs/DEPLOY.md §3.`);
  }
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseWs = supabaseUrl.replace(/^http/, 'ws');

// Next.js injects small inline bootstrap scripts, so script-src needs
// 'unsafe-inline' without a nonce setup; the rest of the policy still blocks
// framing, plugins, foreign form posts and unexpected network destinations.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Map tiles come from configurable HTTPS providers; uploads preview as blob:/data:.
  `img-src 'self' data: blob: https: ${supabaseUrl}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}`.trim(),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Only when the backend itself is HTTPS (i.e. not a local Supabase on http://127.0.0.1).
  ...(!isDev && supabaseUrl.startsWith('https://') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
