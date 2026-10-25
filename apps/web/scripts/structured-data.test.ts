import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkPage, extractJsonLd, missingPageKinds, pageKindFor } from './structured-data.ts';

function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', 'structured-data', name), 'utf8');
}

const PROGRAMME = 'programmes/vce/index.html';

describe('pageKindFor', () => {
  it.each([
    ['index.html', 'home'],
    ['programmes/vce/index.html', 'programme'],
    ['programmes/selective-entry/index.html', 'programme'],
    ['resources/victorian-selective-entry-exam/index.html', 'guide'],
    ['resources/index.html', 'other'],
    ['privacy/index.html', 'other'],
    ['404.html', 'other'],
    ['__spa-fallback.html', 'other'],
  ])('%s is a %s page', (file, kind) => {
    expect(pageKindFor(file)).toBe(kind);
  });
});

describe('missingPageKinds', () => {
  const HOME = 'index.html';
  const GUIDE = 'resources/victorian-selective-entry-exam/index.html';

  it('finds nothing missing in a build with a home, a programme and a guide page', () => {
    expect(missingPageKinds([HOME, PROGRAMME, GUIDE, 'privacy/index.html'])).toEqual([]);
  });

  it('names each kind a partial build lacks, so its rules cannot switch off silently', () => {
    expect(missingPageKinds([HOME])).toEqual(['programme', 'guide']);
    expect(missingPageKinds([HOME, PROGRAMME])).toEqual(['guide']);
    expect(missingPageKinds([PROGRAMME, GUIDE])).toEqual(['home']);
    expect(missingPageKinds([])).toEqual(['home', 'programme', 'guide']);
  });
});

describe('extractJsonLd', () => {
  it('returns each block in order and ignores other scripts', () => {
    const html =
      '<script>var a = 1;</script><script type="application/ld+json">{"a":1}</script>' +
      '<script type="application/ld+json" data-x>{"b":2}</script>';
    expect(extractJsonLd(html)).toEqual(['{"a":1}', '{"b":2}']);
  });
});

describe('checkPage: valid pages from a real build (AC-6.9)', () => {
  it.each([
    ['index.html', 'home-valid.html'],
    [PROGRAMME, 'programme-valid.html'],
    ['resources/victorian-selective-entry-exam/index.html', 'guide-valid.html'],
  ])('%s passes', (file, name) => {
    expect(checkPage(file, fixture(name))).toEqual([]);
  });

  it('accepts a page type with no JSON-LD and no rules', () => {
    expect(checkPage('privacy/index.html', '<html><head></head></html>')).toEqual([]);
  });
});

describe('checkPage: required types', () => {
  it('fails a programme page that carries a guide’s types', () => {
    expect(checkPage(PROGRAMME, fixture('guide-valid.html'))).toEqual([
      { file: PROGRAMME, message: 'has no Course node' },
    ]);
  });

  it('fails a home page with no JSON-LD, naming every missing type', () => {
    expect(checkPage('index.html', '<html></html>').map((problem) => problem.message)).toEqual([
      'has no EducationalOrganization + LocalBusiness node',
      'has no WebSite node',
      'has no FAQPage node',
    ]);
  });

  it('fails a question with no answer text', () => {
    const html = fixture('home-valid.html').replace(
      /"acceptedAnswer":\{[^}]*\}/,
      '"acceptedAnswer":{}',
    );
    expect(checkPage('index.html', html)).toEqual([
      { file: 'index.html', message: 'Question 1 is missing "acceptedAnswer"' },
    ]);
  });
});

// Each invalid fixture is the valid programme page with one defect, so each gives one problem.
describe('checkPage: invalid states (AC-6.10)', () => {
  it('broken JSON', () => {
    const problems = checkPage(PROGRAMME, fixture('broken-json.html'));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe(PROGRAMME);
    expect(problems[0]?.message).toMatch(/^JSON-LD block 1 is not valid JSON/);
  });

  it('a missing required property', () => {
    expect(checkPage(PROGRAMME, fixture('course-missing-provider.html'))).toEqual([
      { file: PROGRAMME, message: 'Course is missing "provider"' },
    ]);
  });

  it('a relative URL', () => {
    expect(checkPage(PROGRAMME, fixture('relative-url.html'))).toEqual([
      {
        file: PROGRAMME,
        message: '"item" is "/programmes/vce", not an absolute https://ajclasses.com.au URL',
      },
    ]);
  });

  it('a non-production URL', () => {
    expect(checkPage(PROGRAMME, fixture('localhost-url.html'))).toEqual([
      {
        file: PROGRAMME,
        message: '"url" is "http://localhost:5173/", not an absolute https://ajclasses.com.au URL',
      },
    ]);
  });

  it('a review or rating', () => {
    expect(checkPage(PROGRAMME, fixture('review.html'))).toEqual([
      {
        file: PROGRAMME,
        message: 'has a node of type AggregateRating, which the site must not publish (R1 F6.4.3)',
      },
    ]);
  });

  it('a review property on another node', () => {
    const html = fixture('programme-valid.html').replace(
      '"@type":"Course",',
      '"@type":"Course","review":{"@type":"Review","reviewBody":"Great"},',
    );
    expect(checkPage(PROGRAMME, html)).toEqual([
      {
        file: PROGRAMME,
        message: 'has a "review" property, which the site must not publish (R1 F6.4.3)',
      },
    ]);
  });

  it('a sameAs link that is not absolute https', () => {
    const html = fixture('home-valid.html').replace(
      '"sameAs":[',
      '"sameAs":["http://example.com/profile",',
    );
    expect(checkPage('index.html', html)).toEqual([
      {
        file: 'index.html',
        message: '"sameAs" is "http://example.com/profile", not an absolute https:// URL',
      },
    ]);
  });
});
