import { describe, expect, it } from 'vitest';

import { ENVIRONMENT_MARKERS, resolveAppEnvironment } from '@/constants';
import { environmentTitle } from '@/lib/seo';

const TITLE = 'NAPLAN Preparation from Year 2 | AJ Classes';

describe('resolveAppEnvironment', () => {
  it('accepts each environment name', () => {
    expect(resolveAppEnvironment('production', false)).toBe('production');
    expect(resolveAppEnvironment('staging', false)).toBe('staging');
    expect(resolveAppEnvironment('development', false)).toBe('development');
  });

  it('defaults to development only on the local dev server', () => {
    expect(resolveAppEnvironment(undefined, true)).toBe('development');
    expect(resolveAppEnvironment('', true)).toBe('development');
  });

  it('fails a build with a missing or misspelt value', () => {
    expect(() => resolveAppEnvironment(undefined, false)).toThrow(/VITE_APP_ENV/);
    expect(() => resolveAppEnvironment('prod', false)).toThrow(/VITE_APP_ENV/);
    expect(() => resolveAppEnvironment('Production', true)).toThrow(/VITE_APP_ENV/);
  });
});

describe('environment markers', () => {
  it('leaves production untouched', () => {
    expect(ENVIRONMENT_MARKERS.production).toBeNull();
    expect(environmentTitle(TITLE, ENVIRONMENT_MARKERS.production)).toBe(TITLE);
  });

  it('puts the environment at the start of the tab title', () => {
    expect(environmentTitle(TITLE, ENVIRONMENT_MARKERS.staging)).toBe(`[STAGING] ${TITLE}`);
    expect(environmentTitle(TITLE, ENVIRONMENT_MARKERS.development)).toBe(`[DEV] ${TITLE}`);
  });

  it('gives staging and dev their own tab icon', () => {
    expect(ENVIRONMENT_MARKERS.staging?.favicon).not.toBe(ENVIRONMENT_MARKERS.development?.favicon);
  });
});
