// Tells a connection problem apart from a bug, so the portal only says "check your connection"
// when that's really the cause. A failed download (data or a page's code) is a TypeError whose
// wording differs by browser, so this matches on those words; any other error is a bug.

const CONNECTION_FAILURE_WORDS = [
  'failed to fetch', // Chrome, Edge: fetch and page-code downloads
  'load failed', // Safari: fetch
  'importing a module script failed', // Safari: page-code downloads
  'networkerror', // Firefox: fetch
  'error loading dynamically imported module', // Firefox: page-code downloads
];

export function isConnectionFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return CONNECTION_FAILURE_WORDS.some((words) => message.includes(words));
}
