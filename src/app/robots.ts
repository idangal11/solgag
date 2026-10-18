import type { MetadataRoute } from 'next';
import { publicConfig } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Personal, authenticated and API routes. Listing pages themselves stay crawlable.
      disallow: ['/dashboard', '/admin', '/account', '/publish', '/inquiries', '/login', '/auth', '/api', '/listing/*/edit'],
    },
    sitemap: `${publicConfig.siteUrl}/sitemap.xml`,
  };
}
