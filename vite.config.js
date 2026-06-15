import { defineConfig } from 'vite';

// Relative base so the build works when hosted in a subfolder (GitHub Pages)
// or wrapped for a store later. Don't use an absolute origin here.
export default defineConfig({
  base: './',
  server: {
    // Honor the PORT env var when one is provided (e.g. by the preview
    // harness); fall back to Vite's default otherwise.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    outDir: 'dist',
  },
});
