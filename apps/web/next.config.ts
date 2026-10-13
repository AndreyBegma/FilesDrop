import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace from the monorepo root so the standalone bundle keeps the workspace
  // layout: the server lands at .next/standalone/apps/web/server.js, with the
  // hoisted node_modules it needs beside it. apps/web/Dockerfile copies that
  // tree as-is.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  reactStrictMode: true,
  transpilePackages: ['@filesdrop/shared'],
};

export default withNextIntl(nextConfig);
