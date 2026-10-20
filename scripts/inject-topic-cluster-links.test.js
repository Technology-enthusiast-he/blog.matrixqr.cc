const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MARKER,
  TOPIC_LINKS,
  buildRelatedLinks,
  injectTopicClusterLinks,
} = require("./inject-topic-cluster-links");

test("builds contextual topic-cluster links", () => {
  const html = buildRelatedLinks([
    ["Static vs dynamic QR codes", "/posts/static-vs-dynamic-qr"],
  ]);

  assert.match(html, new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /href="\/posts\/static-vs-dynamic-qr"/);
  assert.match(html, />Static vs dynamic QR codes<\/a>/);
});

test("injects links immediately before the closing article tag", () => {
  const source = "<article><p>Article</p></article>";
  const updated = injectTopicClusterLinks(source, [
    ["Static vs dynamic QR codes", "/posts/static-vs-dynamic-qr"],
  ]);

  assert.match(updated, /Article<\/p>\n<!-- SEO\/GEO Topic Cluster Links -->/);
  assert.match(updated, /<\/section>\n<\/article>$/);
});

test("is idempotent and does not duplicate the cluster", () => {
  const source = "<article><p>Article</p></article>";
  const once = injectTopicClusterLinks(source, TOPIC_LINKS["posts/static-vs-dynamic-qr.html"]);
  const twice = injectTopicClusterLinks(once, TOPIC_LINKS["posts/static-vs-dynamic-qr.html"]);

  assert.equal(twice, once);
  assert.equal((twice.match(new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1);
});

test("defines both directions for the two primary P1 clusters", () => {
  const links = Object.values(TOPIC_LINKS).flat();
  const urls = new Set(links.map(([, url]) => url));

  assert.ok(urls.has("/posts/2026-10/traditional-menus-digital-menu-qr-code"));
  assert.ok(urls.has("/posts/image-to-qr-menu-guide"));
  assert.ok(urls.has("/posts/custom-logo-qr-code-menu-guide"));
  assert.ok(urls.has("/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"));
  assert.ok(urls.has("/posts/static-vs-dynamic-qr"));
  assert.ok(urls.has("/posts/the-pros-and-cons-of-static-qr-codes"));
  assert.ok(urls.has("/posts/2026-10/introducing-matrixqr-url-generator"));
  assert.ok(urls.has("/posts/vcard-qr-setup"));
});
