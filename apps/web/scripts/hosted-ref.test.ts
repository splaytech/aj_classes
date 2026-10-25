import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findHostedRefs } from './hosted-ref.ts';
import { HOSTED_PROJECT_REF } from './hosting-constants.ts';

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hosted-ref-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findHostedRefs', () => {
  it('lists every file holding the ref, relative and sorted', () => {
    writeFileSync(join(root, 'a.js'), `fetch("https://${HOSTED_PROJECT_REF}.supabase.co")`);
    writeFileSync(join(root, 'b.js'), 'fetch("http://127.0.0.1:55321")');
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'c.html'), `<p>${HOSTED_PROJECT_REF}</p>`);

    expect(findHostedRefs(root)).toEqual(['a.js', join('sub', 'c.html')]);
  });

  it('returns nothing for an empty folder', () => {
    expect(findHostedRefs(root)).toEqual([]);
  });

  it('skips node_modules, binary-type files and symlinks', () => {
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules', 'x.js'), HOSTED_PROJECT_REF);
    writeFileSync(join(root, 'logo.png'), HOSTED_PROJECT_REF);
    const outside = mkdtempSync(join(tmpdir(), 'hosted-ref-outside-'));
    writeFileSync(join(outside, 'linked.js'), HOSTED_PROJECT_REF);
    symlinkSync(outside, join(root, 'linked'));

    expect(findHostedRefs(root)).toEqual([]);
    rmSync(outside, { recursive: true, force: true });
  });

  it('checks a single file given as the root', () => {
    const file = join(root, 'one.txt');
    writeFileSync(file, HOSTED_PROJECT_REF);

    expect(findHostedRefs(file)).toEqual([file]);
  });

  it('throws for a path that does not exist', () => {
    expect(() => findHostedRefs(join(root, 'missing'))).toThrow();
  });
});
