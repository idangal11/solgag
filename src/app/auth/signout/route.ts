import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Sign-out for this device. Called by a plain <form method="post" action="/auth/signout">. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    // The Auth server could not be reached: still drop the session cookies here.
    const store = await cookies();
    for (const c of store.getAll()) if (c.name.startsWith('sb-')) store.delete(c.name);
  }
  revalidatePath('/', 'layout');
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
