import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          amplify: ['aws-amplify'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
