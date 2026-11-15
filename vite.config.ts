import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import { fileURLToPath } from 'url';

function githubPages404Plugin() {
  return {
    name: 'github-pages-404',
    closeBundle() {
      const distDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
      const indexHtml = path.join(distDir, 'index.html');
      const notFoundHtml = path.join(distDir, '404.html');
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, notFoundHtml);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), githubPages404Plugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
