// Offline check of the JSON-LD in the pre-rendered pages (AC-6.9, AC-6.10, 03b §6.7). Google's
// Rich Results Test has no API, so this checks what we can without it:
//   - every application/ld+json block parses;
//   - each page type carries the schema.org types lib/seo.ts emits, with Google's required
//     properties present and non-empty;
//   - every URL-valued key points at the production site, and sameAs links are absolute https;
//   - there is no Review or AggregateRating anywhere (R1 F6.4.3).
// Pure: the CLI (check-structured-data.ts) reads the files.

export type Problem = { file: string; message: string };
export type PageKind = 'home' | 'programme' | 'guide' | 'other';

type JsonObject = Record<string, unknown>;

const SITE_ORIGIN = 'https://ajclasses.com.au';
const URL_KEYS = new Set(['url', 'item', 'logo', 'image', '@id']);
const FORBIDDEN_TYPES = new Set(['Review', 'AggregateRating']);
const FORBIDDEN_KEYS = new Set(['review', 'aggregateRating']);

const JSON_LD_BLOCK =
  /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Which rules apply, from the built file's path relative to build/client. */
export function pageKindFor(relativeFile: string): PageKind {
  const path = relativeFile.replaceAll('\\', '/');
  if (path === 'index.html') return 'home';
  if (/^programmes\/[^/]+\/index\.html$/.test(path)) return 'programme';
  if (/^resources\/[^/]+\/index\.html$/.test(path)) return 'guide';
  return 'other';
}

// A real build always has these, so a folder without one of them is a wrong or partial build:
// its rules would otherwise switch off without a word.
const REQUIRED_PAGE_KINDS: PageKind[] = ['home', 'programme', 'guide'];

/** The page kinds a build must have that `relativeFiles` lacks, in REQUIRED_PAGE_KINDS order. */
export function missingPageKinds(relativeFiles: string[]): PageKind[] {
  const found = new Set(relativeFiles.map(pageKindFor));
  return REQUIRED_PAGE_KINDS.filter((kind) => !found.has(kind));
}

/** The raw text of every JSON-LD block in the page, in order. */
export function extractJsonLd(html: string): string[] {
  return [...html.matchAll(JSON_LD_BLOCK)].map((match) => match[1] ?? '');
}

function typesOf(node: JsonObject): string[] {
  const type = node['@type'];
  if (typeof type === 'string') return [type];
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === 'string');
  return [];
}

/** The top-level nodes of a block: its @graph if it has one, else the block itself. */
function topLevelNodes(block: unknown): JsonObject[] {
  const items = Array.isArray(block) ? block : [block];
  return items.filter(isObject).flatMap((item) => {
    const graph = item['@graph'];
    return Array.isArray(graph) ? graph.filter(isObject) : [item];
  });
}

function isProductionUrl(value: string): boolean {
  return value === SITE_ORIGIN || value.startsWith(`${SITE_ORIGIN}/`);
}

function isAbsoluteHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

/** URL and forbidden-content rules, over every object at any depth. */
function genericProblems(value: unknown, messages: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => genericProblems(item, messages));
    return;
  }
  if (!isObject(value)) return;

  const forbiddenType = typesOf(value).find((type) => FORBIDDEN_TYPES.has(type));
  if (forbiddenType) {
    messages.push(
      `has a node of type ${forbiddenType}, which the site must not publish (R1 F6.4.3)`,
    );
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      messages.push(`has a "${key}" property, which the site must not publish (R1 F6.4.3)`);
      continue;
    }
    if (URL_KEYS.has(key)) {
      for (const url of stringsIn(child).filter((item) => !isProductionUrl(item))) {
        messages.push(`"${key}" is "${url}", not an absolute ${SITE_ORIGIN} URL`);
      }
    }
    if (key === 'sameAs' || key === 'hasMap') {
      for (const url of stringsIn(child).filter((item) => !isAbsoluteHttps(item))) {
        messages.push(`"${key}" is "${url}", not an absolute https:// URL`);
      }
    }
    genericProblems(child, messages);
  }
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return false;
}

/** The first part of a dotted path that is missing or empty, e.g. "provider" or "provider.name". */
function firstMissing(node: JsonObject, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = node;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? '';
    const next: unknown = isObject(current) ? current[part] : undefined;
    if (!isFilled(next)) return parts.slice(0, index + 1).join('.');
    current = next;
  }
  return null;
}

function requireProps(label: string, node: JsonObject, paths: string[], messages: string[]): void {
  for (const path of paths) {
    const missing = firstMissing(node, path);
    if (missing) messages.push(`${label} is missing "${missing}"`);
  }
}

/** The first node carrying every one of `types`, or a problem saying there isn't one. */
function requireNode(nodes: JsonObject[], types: string[], messages: string[]): JsonObject | null {
  const node = nodes.find((candidate) => types.every((type) => typesOf(candidate).includes(type)));
  if (!node) messages.push(`has no ${types.join(' + ')} node`);
  return node ?? null;
}

function eachListed(
  node: JsonObject,
  listKey: string,
  label: string,
  check: (item: JsonObject, itemLabel: string) => void,
): void {
  const list = node[listKey];
  if (!Array.isArray(list)) return;
  list.forEach((item, index) => {
    if (isObject(item)) check(item, `${label} ${index + 1}`);
  });
}

function breadcrumbProblems(nodes: JsonObject[], messages: string[]): void {
  const list = requireNode(nodes, ['BreadcrumbList'], messages);
  if (!list) return;
  requireProps('BreadcrumbList', list, ['itemListElement'], messages);
  eachListed(list, 'itemListElement', 'ListItem', (item, label) => {
    if (typeof item.position !== 'number') messages.push(`${label} has no numeric "position"`);
    requireProps(label, item, ['name', 'item'], messages);
  });
}

function homeProblems(nodes: JsonObject[], messages: string[]): void {
  const organization = requireNode(nodes, ['EducationalOrganization', 'LocalBusiness'], messages);
  if (organization) {
    requireProps('Organization', organization, ['name', 'url', 'logo', 'address'], messages);
  }
  const website = requireNode(nodes, ['WebSite'], messages);
  if (website) requireProps('WebSite', website, ['name', 'url'], messages);
  const faq = requireNode(nodes, ['FAQPage'], messages);
  if (faq) {
    requireProps('FAQPage', faq, ['mainEntity'], messages);
    eachListed(faq, 'mainEntity', 'Question', (question, label) =>
      requireProps(label, question, ['name', 'acceptedAnswer.text'], messages),
    );
  }
}

function programmeProblems(nodes: JsonObject[], messages: string[]): void {
  const course = requireNode(nodes, ['Course'], messages);
  if (course) requireProps('Course', course, ['name', 'description', 'provider.name'], messages);
  breadcrumbProblems(nodes, messages);
}

function guideProblems(nodes: JsonObject[], messages: string[]): void {
  const article = requireNode(nodes, ['Article'], messages);
  if (article) {
    requireProps('Article', article, ['headline', 'author.name', 'publisher.name'], messages);
  }
  breadcrumbProblems(nodes, messages);
}

const KIND_RULES: Record<PageKind, (nodes: JsonObject[], messages: string[]) => void> = {
  home: homeProblems,
  programme: programmeProblems,
  guide: guideProblems,
  other: () => undefined,
};

/** Every structured-data problem on one built page. */
export function checkPage(relativeFile: string, html: string): Problem[] {
  const messages: string[] = [];
  const blocks: unknown[] = [];
  extractJsonLd(html).forEach((text, index) => {
    try {
      blocks.push(JSON.parse(text));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      messages.push(`JSON-LD block ${index + 1} is not valid JSON (${reason})`);
    }
  });

  // A block that doesn't parse would also show up as "missing" types, which is noise: report
  // the parse error alone, so the fix is obvious.
  if (messages.length === 0) {
    blocks.forEach((block) => genericProblems(block, messages));
    KIND_RULES[pageKindFor(relativeFile)](blocks.flatMap(topLevelNodes), messages);
  }
  return messages.map((message) => ({ file: relativeFile, message }));
}
