const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const INDEX_FILE = path.join(ROOT, "index.html");
const SITE_ORIGIN = "https://blog.matrixqr.cc";

const SECTIONS = [
  ["Security", "<!-- AUTO-SECURITY-START -->", "<!-- AUTO-SECURITY-END -->"],
  ["Digital Menu", "<!-- AUTO-MENU-START -->", "<!-- AUTO-MENU-END -->"],
  ["Latest Articles", "<!-- AUTO-POSTS-START -->", "<!-- AUTO-POSTS-END -->"],
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function normalizeUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value).replace(/&amp;/g, "&"), SITE_ORIGIN);
    let pathname = parsed.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      // Keep the encoded pathname if decoding fails.
    }
    return pathname.replace(/\/+$/, "").toLowerCase() || "/";
  } catch {
    return "";
  }
}

function markerRange(html, start, end) {
  const startCount = html.split(start).length - 1;
  const endCount = html.split(end).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    fail(`Expected exactly one occurrence of each marker: ${start} / ${end} (found ${startCount} / ${endCount})`);
    return null;
  }
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end);
  if (endIndex < startIndex + start.length) {
    fail(`Markers are out of order: ${start} / ${end}`);
    return null;
  }
  return { startIndex, endIndex };
}

function extractArticleUrls(html, knownUrls) {
  const found = new Set();
  const hrefPattern = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const url = normalizeUrl(match[1]);
    if (knownUrls.has(url)) found.add(url);
  }
  return found;
}

for (const file of [POSTS_FILE, INDEX_FILE]) {
  if (!fs.existsSync(file)) {
    fail(`Required file not found: ${path.relative(ROOT, file)}`);
  }
}
if (process.exitCode) process.exit(1);

let posts;
try {
  posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
} catch (error) {
  fail(`Unable to parse posts.json: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(posts)) {
  fail("posts.json must contain an array.");
  process.exit(1);
}

const seenUrls = new Map();
const validPosts = [];
for (const [index, post] of posts.entries()) {
  const url = normalizeUrl(post && post.url);
  if (!url) {
    fail(`posts.json item #${index + 1} has a missing or invalid URL.`);
    continue;
  }
  if (seenUrls.has(url)) {
    fail(`Duplicate post URL in posts.json: ${url} (items #${seenUrls.get(url) + 1} and #${index + 1}).`);
    continue;
  }
  seenUrls.set(url, index);
  validPosts.push({ ...post, normalizedUrl: url });
}
if (process.exitCode) process.exit(1);

let html = fs.readFileSync(INDEX_FILE, "utf8");
const ranges = [];
for (const [name, start, end] of SECTIONS) {
  const range = markerRange(html, start, end);
  if (range) ranges.push({ name, start, end, ...range });
}
if (process.exitCode || ranges.length !== SECTIONS.length) process.exit(1);

// Separate hand-curated links from generated regions before counting.
let manualHtml = html;
for (const section of [...ranges].sort((a, b) => b.startIndex - a.startIndex)) {
  manualHtml = manualHtml.slice(0, section.startIndex) +
    manualHtml.slice(section.endIndex + section.end.length);
}

const knownUrls = new Set(validPosts.map((post) => post.normalizedUrl));
const manualUrls = extractArticleUrls(manualHtml, knownUrls);
const automaticUrlsBySection = new Map();
for (const section of ranges) {
  const content = html.slice(section.startIndex + section.start.length, section.endIndex);
  automaticUrlsBySection.set(section.name, extractArticleUrls(content, knownUrls));
}

const automaticUrls = new Set();
for (const urls of automaticUrlsBySection.values()) {
  for (const url of urls) {
    if (automaticUrls.has(url)) {
      fail(`An article is linked in more than one automatic homepage section: ${url}`);
    }
    automaticUrls.add(url);
  }
}
for (const url of automaticUrls) {
  if (manualUrls.has(url)) {
    fail(`An article is both manually linked and automatically generated on the homepage: ${url}`);
  }
}
if (process.exitCode) process.exit(1);

const displayedUrls = new Set([...manualUrls, ...automaticUrls]);
const undisplayed = validPosts.filter((post) => !displayedUrls.has(post.normalizedUrl));
const categoryCounts = new Map();
for (const post of validPosts) {
  const category = String(post.category || "(missing category)").trim() || "(missing category)";
  categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
}

console.log("");
console.log("======================================");
console.log(" MatrixQR Homepage Diagnostics");
console.log("======================================");
console.log(`Posts in posts.json: ${validPosts.length}`);
console.log(`Manual homepage article links: ${manualUrls.size}`);
for (const section of ranges) {
  console.log(`Automatic ${section.name} article links: ${automaticUrlsBySection.get(section.name).size}`);
}
console.log(`Unique articles linked on homepage: ${displayedUrls.size}`);
console.log(`Articles not currently linked on homepage: ${undisplayed.length}`);

if (undisplayed.length) {
  console.warn("NOTE: Unlinked articles are informational only; homepage sections intentionally show a limited selection.");
  for (const post of undisplayed) {
    console.warn(`  - ${post.title || "(untitled)"} — ${post.url} [${post.category || "uncategorized"}]`);
  }
}
console.log("Category distribution:");
for (const [category, count] of [...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  - ${category}: ${count}`);
}
console.log("Homepage diagnostics passed.");
