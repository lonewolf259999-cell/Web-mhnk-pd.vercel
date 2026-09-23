import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

/* eslint-config-next still ships the old config format, so FlatCompat bridges
   it into flat config. `next lint` is gone from the scripts: it is deprecated
   in Next 15 and removed in 16, so `npm run lint` calls the ESLint CLI. */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default config;
