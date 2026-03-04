import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '$lib': path.resolve('/Volumes/MacExt/Projects/pixdock/frontend/src/lib'),
      '$app': path.resolve('/Volumes/MacExt/Projects/pixdock/frontend/src/app'),
    },
  },
});
