import { getProspectRoofs } from '@/app/admin/_lib/prospects';
import { getMyProfile } from '@/lib/data/queries';
import { applyProspectFilters, parseProspectFilters, prospectsToCsv } from '@/lib/prospects';

// CSV export of the business-prospect pilot, with the same filters as the
// review screen (?minArea=…&review=…). Admin-only: everyone else gets a 404,
// like the rest of /admin, and RLS returns no rows to non-admins anyway.

export async function GET(request: Request) {
  const profile = await getMyProfile();
  if (!profile?.isAdmin) return new Response('Not found', { status: 404 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const roofs = applyProspectFilters(await getProspectRoofs(), parseProspectFilters(sp));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(prospectsToCsv(roofs), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="solgag-prospects-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
