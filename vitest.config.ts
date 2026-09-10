import { defineConfig } from 'vitest/config';
import path from 'node:path';

// The rules engine and content are deliberately framework-free, so they run
// in a plain Node environment with no React Native transform in the way.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
