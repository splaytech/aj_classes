// Runs before every test file.

import '@testing-library/jest-dom/vitest'; // adds matchers such as `toBeInTheDocument()`
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Unit tests never reach a real server. The site header checks for news on every render, and
// the test environment reads the local Supabase URL from .env.local, so without this a test
// would quietly call the local database. A test that needs fetch stubs its own.
// Stub globals in beforeEach, not beforeAll or at module scope: afterEach below removes them.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Unit tests never use the network'))),
  );
});

// jsdom does no layout, so it has no scrollIntoView; forms call it to bring a bad field into view.
// A no-op here; a test that checks the scrolling spies on it. (Node-environment files have no DOM.)
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Remove whatever the previous test rendered, so tests never see each other's output.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
