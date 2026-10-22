// @vitest-environment node
// Text colours stay readable in both portal themes (R3b review F22): WCAG AA, 4.5:1 for text.
// Reads theme.css itself, so changing a colour there can't quietly break contrast.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// Vitest doesn't load CSS imports (they come back empty), so read the file itself.
const themeCss = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');

const AA_TEXT = 4.5;

// [text token, background token] pairs the portal actually uses.
const TEXT_PAIRS = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-bg-subtle'],
  ['--color-text-muted', '--color-bg'],
  ['--color-text-muted', '--color-surface'],
  ['--color-text-muted', '--color-bg-subtle'],
  ['--color-text-emphasis', '--color-surface'],
  ['--color-primary', '--color-bg'],
  ['--color-primary', '--color-surface'],
  ['--color-on-primary', '--color-primary'],
  ['--color-error', '--color-surface'],
  ['--color-success', '--color-surface'],
  ['--color-warning', '--color-surface'],
  ['--color-text-inverse', '--color-bg-inverse'],
] as const;

/** The hex colours declared in the first block whose selector contains `selector`. */
function colourTokens(selector: string): Record<string, string> {
  const start = themeCss.indexOf(selector);
  const block = themeCss.slice(themeCss.indexOf('{', start) + 1, themeCss.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})/gi)) {
    tokens[name as string] = hex as string;
  }
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

const light = colourTokens("[data-portal-theme='light']");
const dark = { ...light, ...colourTokens("[data-portal-theme='dark']") };

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, tokens) => {
  it.each(TEXT_PAIRS)('%s on %s meets WCAG AA', (text, background) => {
    expect(tokens[text]).toBeDefined();
    expect(tokens[background]).toBeDefined();
    expect(contrast(tokens[text] as string, tokens[background] as string)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});
