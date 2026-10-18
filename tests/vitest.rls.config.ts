import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Database security (RLS) tests against the LOCAL Supabase stack — see tests/rls.test.ts.
// Run: npx vitest run --config tests/vitest.rls.config.ts
// The default `npx vitest run` (vitest.config.ts) only includes src/**/*.test.ts, so it never runs these.

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn(
    '\n[rls] SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are not set — all RLS tests will be SKIPPED.\n' +
      '      Start the local stack (npx supabase start), then copy ANON_KEY / SERVICE_ROLE_KEY from `npx supabase status -o env`.\n',
  );
}

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
