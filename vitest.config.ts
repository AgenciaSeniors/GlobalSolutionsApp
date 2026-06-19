// vitest.config.ts
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Los specs de `e2e/` son de Playwright (otro runner) — Vitest no debe correrlos.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` lanza error fuera de un RSC; en tests lo stubeamos a vacío
      // para que los módulos server-side (ej. supabase/server.ts) se puedan importar.
      'server-only': path.resolve(__dirname, './vitest.server-only-stub.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '.next/',
        '**/*.d.ts',
        '**/*.config.*',
      ]
    },
  },
});