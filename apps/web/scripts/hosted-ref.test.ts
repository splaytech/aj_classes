import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hostedRefProblem, scanForHostedRefs } from './hosted-ref.ts';
import { HOSTED_PROJECT_REF } from './hosting-constants.ts';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hosted-ref-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('scanForHostedRefs', () => {
  it('lists every file holding the ref, relative and sorted, and counts what it read', () => {
    writeFileSync(join(root, 'a.js'), `fetch("https://${HOSTED_PROJECT_REF}.supabase.co")`);
    writeFileSync(join(root, 'b.js'), 'fetch("http://127.0.0.1:55321")');
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'c.html'), `<p>${HOSTED_PROJECT_REF}</p>`);

    expect(scanForHostedRefs(root)).toEqual({ scanned: 3, hits: ['a.js', join('sub', 'c.html')] });
  });

  it('reads file types beyond scripts and HTML, such as .css, .svg and .data', () => {
    writeFileSync(
      join(root, 'site.css'),
      `@import url(https://${HOSTED_PROJECT_REF}.supabase.co/x.css);`,
    );
    writeFileSync(
      join(root, 'logo.svg'),
      `<svg><image href="https://${HOSTED_PROJECT_REF}.supabase.co/a"/></svg>`,
    );
    writeFileSync(join(root, 'posts.data'), HOSTED_PROJECT_REF);
    writeFileSync(join(root, 'no-extension'), HOSTED_PROJECT_REF);

    expect(scanForHostedRefs(root).hits).toEqual([
      'logo.svg',
      'no-extension',
      'posts.data',
      'site.css',
    ]);
  });

  it('skips node_modules, known binary types and symlinks', () => {
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules', 'x.js'), HOSTED_PROJECT_REF);
    writeFileSync(join(root, 'logo.PNG'), HOSTED_PROJECT_REF);
    writeFileSync(join(root, 'font.woff2'), HOSTED_PROJECT_REF);
    const outside = mkdtempSync(join(tmpdir(), 'hosted-ref-outside-'));
    writeFileSync(join(outside, 'linked.js'), HOSTED_PROJECT_REF);
    symlinkSync(outside, join(root, 'linked'));

    expect(scanForHostedRefs(root)).toEqual({ scanned: 0, hits: [] });
    rmSync(outside, { recursive: true, force: true });
  });

  it('checks a single file given as the root', () => {
    const file = join(root, 'one.txt');
    writeFileSync(file, HOSTED_PROJECT_REF);

    expect(scanForHostedRefs(file)).toEqual({ scanned: 1, hits: [file] });
  });

  it('throws for a path that does not exist', () => {
    expect(() => scanForHostedRefs(join(root, 'missing'))).toThrow();
  });
});

describe('hostedRefProblem', () => {
  it('fails an empty folder, because a scan that read nothing proves nothing', () => {
    expect(hostedRefProblem(root, scanForHostedRefs(root))).toMatch(/scanned 0 files/);
  });

  it('fails on a hit and passes a clean folder', () => {
    writeFileSync(join(root, 'clean.js'), 'ok');
    expect(hostedRefProblem(root, scanForHostedRefs(root))).toBeNull();

    writeFileSync(join(root, 'dirty.css'), HOSTED_PROJECT_REF);
    expect(hostedRefProblem(root, scanForHostedRefs(root))).toMatch(/1 files .* dirty\.css/);
  });
});
