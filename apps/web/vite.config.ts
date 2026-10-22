import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

import { resolveAppEnvironment } from './src/constants/app-environment.constants.ts';

// Branch and commit for the staging and dev label (environments.md). Vercel sets these during
// its builds; Vite then passes them to the site like any other VITE_ setting.
process.env.VITE_BUILD_BRANCH ??= process.env.VERCEL_GIT_COMMIT_REF ?? '';
process.env.VITE_BUILD_COMMIT ??= (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);

/** Stops a build straight away, with a clear message, if VITE_APP_ENV is missing (G1). */
function requireAppEnvironment(): Plugin {
  let value: string | undefined;
  return {
    name: 'require-app-environment',
    apply: 'build',
    configResolved(config) {
      value = config.env.VITE_APP_ENV;
    },
    buildStart() {
      resolveAppEnvironment(value, false);
    },
  };
}

export default defineConfig({
  plugins: [requireAppEnvironment(), reactRouter()],
  resolve: { tsconfigPaths: true }, // enables the "@/..." import alias from tsconfig.json
});
