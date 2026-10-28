const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const REPO_ROOT = path.join(__dirname, "..");
const VALIDATOR = path.join(__dirname, "validate-seo-structured-data.js");
const ORIGIN = "https://blog.matrixqr.cc";
const PUBLISHED = "2026-10-01T08:00:00+08:00";
const MODIFIED = "2026-10-02T09:00:00+08:00";
function pageHtml(url, title) {
  const description = "A test page description.";
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", url, name: title, description });
  return '<html><head><title>' + title + '</title><link rel="canonical" href="' + url + '"><meta name="description" content="' + description + '"><meta property="og:url" content="' + url + '"><meta property="og:title" content="' + title + '"><meta name="twitter:title" content="' + title + '"><meta property="og:description" content="' + description + '"><meta name="twitter:description" content="' + description + '"><script type="application/ld+json">' + schema + '</script></head><body></body></html>';
}
function articleHtml(options) {
  const o = options || {};
  const published = o.published || PUBLISHED;
  const modified = o.modified || MODIFIED;
  const ogImage = o.ogImage || "/images/fixture.png";
  const twitterImage = o.twitterImage || ogImage;
  const schemaImage = o.schemaImage || ogImage;
  const url = ORIGIN + "/posts/fixture";
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", mainEntityOfPage: { "@id": url }, datePublished: published, dateModified: modified, image: schemaImage });
  const pubText = new Date(published).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const modText = new Date(modified).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return '<html><head><link rel="canonical" href="' + url + '"><meta property="article:published_time" content="' + published + '"><meta property="article:modified_time" content="' + modified + '"><meta property="og:image" content="' + ogImage + '"><meta name="twitter:image" content="' + twitterImage + '"><script type="application/ld+json">' + schema + '</script></head><body><div class="meta-info">Published on ' + pubText + ' • Updated ' + modText + '</div></body></html>';
}
function fixture(options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-seo-test-"));
  fs.mkdirSync(path.join(root, "posts"), { recursive: true });
  fs.mkdirSync(path.join(root, "sitemap"), { recursive: true });
  fs.mkdirSync(path.join(root, "images"), { recursive: true });
  fs.writeFileSync(path.join(root, "images", "fixture.png"), "fixture");
  fs.writeFileSync(path.join(root, "index.html"), pageHtml(ORIGIN + "/", "Fixture Home"));
  fs.writeFileSync(path.join(root, "posts", "index.html"), pageHtml(ORIGIN + "/posts/", "Fixture Archive"));
  fs.writeFileSync(path.join(root, "posts", "fixture.html"), articleHtml(options));
  fs.writeFileSync(path.join(root, "posts.json"), JSON.stringify([{ url: ORIGIN + "/posts/fixture/", title: "Fixture", datePublished: PUBLISHED }]));
  fs.writeFileSync(path.join(root, "sitemap", "index.html"), '<!-- AUTO-SITEMAP-START --><a href="' + ORIGIN + '/posts/fixture/">Fixture</a><!-- AUTO-SITEMAP-END -->');
  return root;
}
function run(root) { return spawnSync(process.execPath, [VALIDATOR], { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, MATRIXQR_VALIDATION_ROOT: root } }); }
test("accepts valid fixture metadata", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); });
test("rejects date-only publication timestamp", t => { const root = fixture({ published: "2026-10-01" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /datePublished must be a valid ISO 8601 datetime with timezone/); });
test("rejects mismatched social images", t => { const root = fixture({ twitterImage: "/images/other.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:image and twitter:image do not match/); });
test("rejects missing local image files", t => { const root = fixture({ ogImage: "/images/missing.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /points to a missing local file/); });
test("rejects modified date earlier than publication", t => { const root = fixture({ published: "2026-10-03T08:00:00+08:00", modified: "2026-10-02T09:00:00+08:00" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /dateModified is earlier than datePublished/); });
test("rejects visible publication date that differs from JSON-LD", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Published on October 1, 2026", "Published on September 30, 2026")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /visible published date .* differs from Article JSON-LD datePublished/); });
