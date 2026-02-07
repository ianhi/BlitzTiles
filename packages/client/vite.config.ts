import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.GITHUB_PAGES ? '/BlitzTiles/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ['@dnd-kit/utilities'],
  },
});
