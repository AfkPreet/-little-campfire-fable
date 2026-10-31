import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) } },
  },
  server: { strictPort: true },
});
