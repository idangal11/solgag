import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Listing photos are already resized client-side and served from Supabase Storage.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['.next/**', '.tools/**', 'node_modules/**', 'prototype/**', 'research/**', 'supabase/**', 'next-env.d.ts', 'src/lib/database.types.ts'] },
];

export default config;
