// Which copy of the site a build is (docs/requirements/release-1/environments.md).
// No environment reads here, so vite.config.ts can use it to check a build before it starts.

export const APP_ENVIRONMENTS = ['production', 'staging', 'development'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/**
 * Checks the VITE_APP_ENV value. Only the local dev server may leave it out (it's then
 * "development"); a build without a valid value fails rather than guess (environments.md G1).
 */
export function resolveAppEnvironment(
  value: string | undefined,
  isDevServer: boolean,
): AppEnvironment {
  if (!value && isDevServer) return 'development';
  const environment = APP_ENVIRONMENTS.find((name) => name === value);
  if (!environment) {
    throw new Error(
      `VITE_APP_ENV must be one of: ${APP_ENVIRONMENTS.join(', ')}. Got "${value ?? ''}".`,
    );
  }
  return environment;
}
