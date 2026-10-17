const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS = path.join(ROOT, 'posts');
const SITE = 'https://blog.matrixqr.cc';
const INPUTS = [path.join(ROOT, 'llms.txt'), path.join(ROOT, 'llms-full.txt')];
const REPORT = path.join(ROOT, 'article-link-report.md');
const CONCURRENCY = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.LINK_CHECK_TIMEOUT_MS || 30000);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) out[m[1].toLowerCase()] = m[3];
  return out;
}

function canonicalUrl(html, file) {
  const match = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  if (match) return new URL(match[1], SITE).href;
  const rel = path.relative(POSTS, file).replaceAll(path.sep, '/').replace(/\.html$/i, '');
  return `${SITE}/posts/${rel}`;
}

function stripFragment(value) {
  const hash = value.indexOf('#');
  return hash >= 0 ? value.slice(0, hash) : value;
}

function normalizeMarkdownUrl(value) {
  let url = value.replace(/\\([()])/g, '$1').replace(/[.,;]+$/, '');
  let depth = 0;
  for (const char of url) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
  }
  while (depth < 0 && url.endsWith(')')) {
    url = url.slice(0, -1);
    depth++;
  }
  return url;
}

function collectFromHtml(file) {
  const html = fs.readFileSync(file, 'utf8');
  const pageUrl = canonicalUrl(html, file);
  const links = [];
  const tagRe = /<(a|img|source|script|link)\b[^>]*>/gi;
  for (const match of html.matchAll(tagRe)) {
    const tag = match[0];
    const attrs = attributes(tag);
    const name = match[1].toLowerCase();
    const attr = name === 'a' || name === 'link' ? 'href' : 'src';
    if (!attrs[attr]) continue;
    const raw = attrs[attr].trim();
    if (!raw || /^(data:|javascript:|mailto:|tel:|#)/i.test(raw)) continue;
    try {
      links.push({ source: path.relative(ROOT, file), url: stripFragment(new URL(raw, pageUrl).href), raw });
    } catch {
      links.push({ source: path.relative(ROOT, file), url: raw, raw, invalid: true });
    }
  }
  return links;
}

function collectFromMarkdown(file) {
  const text = fs.readFileSync(file, 'utf8');
  const links = [];
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    const raw = normalizeMarkdownUrl(match[0]);
    try {
      links.push({ source: path.relative(ROOT, file), url: stripFragment(new URL(raw).href), raw });
    } catch {
      links.push({ source: path.relative(ROOT, file), url: raw, raw, invalid: true });
    }
  }
  return links;
}

function unique(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.source}\n${item.url}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

async function request(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if ([405, 403, 429].includes(response.status) || response.status >= 500) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { status: response.status, finalUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function classify(result) {
  if (result.invalid) return 'invalid';
  if (result.error) return 'network';
  if (result.status === 404 || result.status === 410) return 'broken';
  if (result.status >= 400 && result.status < 600) return 'warning';
  return 'ok';
}

async function main() {
  if (!fs.existsSync(POSTS)) throw new Error('Posts directory not found');
  const files = walk(POSTS);
  let items = [];
  for (const file of files) items.push(...collectFromHtml(file));
  for (const file of INPUTS) if (fs.existsSync(file)) items.push(...collectFromMarkdown(file));
  items = unique(items);

  const results = await mapLimit(items, CONCURRENCY, async item => {
    if (item.invalid) return { ...item, invalid: true };
    try {
      return { ...item, ...(await request(item.url)) };
    } catch (error) {
      return { ...item, error: error.name === 'AbortError' ? 'timeout' : error.message };
    }
  });

  const groups = { broken: [], invalid: [], network: [], warning: [], ok: [] };
  for (const result of results) groups[classify(result)].push(result);

  const lines = [
    '# Article Link Check Report', '',
    `Checked: ${new Date().toISOString()}`,
    `Inputs: ${files.length} article HTML files + ${INPUTS.filter(fs.existsSync).length} generated LLM files`,
    `Unique URLs: ${results.length}`, '',
    `- OK: ${groups.ok.length}`,
    `- Broken (404/410): ${groups.broken.length}`,
    `- Network errors: ${groups.network.length}`,
    `- Other HTTP warnings (4xx/5xx): ${groups.warning.length}`,
    `- Invalid URLs: ${groups.invalid.length}`,
  ];

  for (const [title, group] of [
    ['Broken (404/410)', groups.broken],
    ['Network errors', groups.network],
    ['Other HTTP warnings', groups.warning],
    ['Invalid URLs', groups.invalid],
  ]) {
    if (!group.length) continue;
    lines.push('', `## ${title}`, '');
    for (const item of group) lines.push(`- ${item.url} — ${item.error || item.status} — ${item.source}`);
  }
  fs.writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');

  console.log(`Checked ${results.length} unique URLs from ${files.length} article files.`);
  console.log(`OK=${groups.ok.length} broken=${groups.broken.length} network=${groups.network.length} warnings=${groups.warning.length} invalid=${groups.invalid.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT)}`);
  if (groups.broken.length || groups.invalid.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error('[links] ERROR:', error);
    process.exitCode = 1;
  });
}

module.exports = { canonicalUrl, collectFromHtml, collectFromMarkdown, classify, normalizeMarkdownUrl };