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
  return '<html><head><title>' + title + '</title><link rel="canonical" href="' + url + '"><meta name="description" content="' + description + '"><meta property="og:url" content="' + url + '"><meta property="og:title" content="' + title + '"><meta name="twitter:title" content="' + title + '"><meta property="og:description" content="' + description + '"><meta name="twitter:description" content="' + description + '"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">' + schema + '</script></head><body></body></html>';
}
function articleHtml(options) {
  const o = options || {};
  const published = o.published || PUBLISHED;
  const modified = o.modified || MODIFIED;
  const ogImage = Object.prototype.hasOwnProperty.call(o, "ogImage") ? o.ogImage : "/images/fixture.png";
  const twitterImage = Object.prototype.hasOwnProperty.call(o, "twitterImage") ? o.twitterImage : ogImage;
  const schemaImage = Object.prototype.hasOwnProperty.call(o, "schemaImage") ? o.schemaImage : ogImage;
  const url = ORIGIN + "/posts/fixture";

  const displayCalendarDate = value => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  };
  const pubText = displayCalendarDate(published);
  const modText = displayCalendarDate(modified);
  const headline = Object.prototype.hasOwnProperty.call(o, "headline") ? o.headline : "Fixture Article";
  const description = Object.prototype.hasOwnProperty.call(o, "description") ? o.description : "A fixture article description.";
  const metaDescription = Object.prototype.hasOwnProperty.call(o, "metaDescription") ? o.metaDescription : description;
  const twitterCard = Object.prototype.hasOwnProperty.call(o, "twitterCard") ? o.twitterCard : "summary_large_image";
  const schema = JSON.stringify({ "@context": "https://schema.org", "@type": "BlogPosting", headline, description, ...(o.schemaUrl ? { url: o.schemaUrl } : {}), mainEntityOfPage: { "@id": url }, datePublished: published, dateModified: modified, image: schemaImage });
  const standardDescriptionTag = '<meta name="description" content="' + metaDescription + '">';
  const articleHead = '<html><head><title>' + headline + '</title><link rel="canonical" href="' + url + '">' + standardDescriptionTag + '<meta property="article:published_time" content="' + published + '"><meta property="article:modified_time" content="' + modified + '"><meta property="og:url" content="' + (o.ogUrl ?? url) + '"><meta property="og:title" content="' + (o.ogTitle ?? headline) + '"><meta name="twitter:title" content="' + (o.twitterTitle ?? headline) + '"><meta property="og:description" content="' + (o.ogDescription ?? description) + '"><meta name="twitter:description" content="' + (o.twitterDescription ?? description) + '"><meta name="twitter:card" content="' + twitterCard + '"><meta property="og:image" content="' + ogImage + '"><meta name="twitter:image" content="' + twitterImage + '"><script type="application/ld+json">' + schema + '</script></head><body><div class="meta-info">Published on ' + pubText + ' • Updated ' + modText + '</div></body></html>';
  return articleHead;
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
  fs.writeFileSync(path.join(root, "sitemap", "index.html"), pageHtml(ORIGIN + "/sitemap/", "Fixture Sitemap").replace("</body></html>", '<!-- AUTO-SITEMAP-START --><a href="' + ORIGIN + '/posts/fixture/">Fixture</a><!-- AUTO-SITEMAP-END --></body></html>'));
  return root;
}
function run(root) { return spawnSync(process.execPath, [VALIDATOR], { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, MATRIXQR_VALIDATION_ROOT: root } }); }
test("accepts valid fixture metadata", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); });
test("rejects HTML sitemap canonical that differs from its route", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "sitemap", "index.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(ORIGIN + "/sitemap/", ORIGIN + "/other/")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /sitemap\/index\.html: canonical is .* expected/); });
test("rejects HTML sitemap CollectionPage URL that differs from its canonical", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "sitemap", "index.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('"url":"' + ORIGIN + '/sitemap/"', '"url":"' + ORIGIN + '/other/"')); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /sitemap\/index\.html: CollectionPage JSON-LD URL is .* expected/); });
test("rejects date-only publication timestamp", t => { const root = fixture({ published: "2026-10-01" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /datePublished must be a valid ISO 8601 datetime with timezone/); });
test("rejects mismatched social images", t => { const root = fixture({ twitterImage: "/images/other.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:image and twitter:image do not match/); });
test("rejects missing local image files", t => { const root = fixture({ ogImage: "/images/missing.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /points to a missing local file/); });
test("rejects modified date earlier than publication", t => { const root = fixture({ published: "2026-10-03T08:00:00+08:00", modified: "2026-10-02T09:00:00+08:00" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /dateModified is earlier than datePublished/); });
test("accepts visible calendar dates when timezone offset crosses UTC midnight", t => { const root = fixture({ published: "2026-10-01T00:30:00+08:00", modified: "2026-10-02T00:15:00+08:00" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); });
test("rejects visible publication date that differs from JSON-LD", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Published on October 1, 2026", "Published on September 30, 2026")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /visible published date .* differs from Article JSON-LD datePublished/); });

test("rejects malformed percent-encoded local image paths", t => { const root = fixture({ ogImage: "/images/%ZZ.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /contains an invalid encoded path/); });
test("rejects local image paths that escape the repository root", t => { const root = fixture({ ogImage: "/%2e%2e%2foutside.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /resolves outside the repository/); });
test("rejects missing Open Graph image metadata", t => { const root = fixture({ ogImage: "" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /missing og:image/); });
test("rejects Article JSON-LD image that differs from og:image", t => { const root = fixture({ schemaImage: "/images/other.png" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:image is not included in Article JSON-LD image/); });

test("rejects mismatched Open Graph and Twitter titles", t => { const root = fixture({ twitterTitle: "Different title" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:title and twitter:title do not match/); });
test("rejects mismatched Open Graph and Twitter descriptions", t => { const root = fixture({ twitterDescription: "Different description" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:description and twitter:description do not match/); });
test("rejects unsupported Twitter card type", t => { const root = fixture({ twitterCard: "player" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /twitter:card must be summary or summary_large_image/); });
test("reports Article JSON-LD headline differences without mutating source articles", t => { const root = fixture({ ogTitle: "Different social title", twitterTitle: "Different social title" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stderr, /Article JSON-LD headline differs from og:title; source article left unchanged/); });
test("rejects Article JSON-LD description that differs from og:description", t => { const root = fixture({ ogDescription: "Different social description" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /Article JSON-LD description differs from og:description/); });

test("rejects article og:url that differs from canonical", t => { const root = fixture({ ogUrl: ORIGIN + "/posts/other" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /og:url is .* expected canonical/); });
test("rejects Article JSON-LD url that differs from canonical", t => { const root = fixture({ schemaUrl: ORIGIN + "/posts/other" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /Article JSON-LD url is .* expected canonical/); });
test("accepts matching article og:url and optional JSON-LD url", t => { const root = fixture({ schemaUrl: ORIGIN + "/posts/fixture/" }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); });


test("requires the standard meta description on article sources", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/<meta name="description" content="[^"]*">/, "")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /missing meta description/); });
test("warns when an article meta description intentionally differs from social descriptions", t => { const root = fixture({ description: "Social sharing copy.", metaDescription: "Search-focused snippet.", ogDescription: "Social sharing copy.", twitterDescription: "Social sharing copy." }); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const result = run(root); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stderr, /meta description and og:description use different wording; review for intentional variation/); });

test("validates visible publication dates without the word on", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Published on October 1, 2026", "Published Aug 13, 2026")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /visible published date .* differs from Article JSON-LD datePublished/); });
test("validates visible publication dates after a colon", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Published on October 1, 2026", "Published: Aug 13, 2026")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /visible published date .* differs from Article JSON-LD datePublished/); });

test("validates visible update dates with a colon", t => { const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const file = path.join(root, "posts", "fixture.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Updated October 2, 2026", "Updated: October 1, 2026")); const result = run(root); assert.notEqual(result.status, 0); assert.match(result.stderr, /visible updated date .* differs from Article JSON-LD dateModified/); });
