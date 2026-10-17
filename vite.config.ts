import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '1a3e-2405-201-f002-5a76-d10-c446-bea2-fc6a.ngrok-free.app',
        '.ngrok-free.app',
        '.ngrok.app',
        'pulseflow-whatsapp-ai-crm-web.onrender.com',
        '.onrender.com',
        '.run.app',
        ...(process.env.RENDER_EXTERNAL_HOSTNAME ? [process.env.RENDER_EXTERNAL_HOSTNAME] : []),
        ...(process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim()) : []),
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
