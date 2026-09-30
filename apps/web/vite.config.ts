import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter()],
  resolve: { tsconfigPaths: true }, // enables the "@/..." import alias from tsconfig.json
});
