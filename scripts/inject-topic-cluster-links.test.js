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


test("every configured source and target resolves to an existing article file", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");

  function articlePath(url) {
    assert.match(url, /^\/posts\//, `Expected a local article URL: ${url}`);
    const relative = url.replace(/^\/posts\//, "");
    return path.join(root, "posts", relative + ".html");
  }

  for (const [source, links] of Object.entries(TOPIC_LINKS)) {
    assert.ok(fs.existsSync(path.join(root, source)), `Missing source article: ${source}`);
    for (const [, url] of links) {
      const target = articlePath(url);
      assert.ok(fs.existsSync(target), `${source} links to missing article: ${url}`);
    }
  }
});

test("links between configured cluster pages are reciprocal", () => {
  const outgoing = new Map(
    Object.entries(TOPIC_LINKS).map(([source, links]) => [
      "/" + source.replace(/\.html$/, "").replace(/^posts\//, "posts/"),
      new Set(links.map(([, url]) => url)),
    ])
  );

  for (const [source, links] of Object.entries(TOPIC_LINKS)) {
    const sourceUrl = "/" + source.replace(/\.html$/, "").replace(/^posts\//, "posts/");
    for (const [, targetUrl] of links) {
      const reverseLinks = outgoing.get(targetUrl);
      if (!reverseLinks) continue;
      assert.ok(
        reverseLinks.has(sourceUrl),
        `Expected reciprocal topic link: ${targetUrl} -> ${sourceUrl}`
      );
    }
  }
});

test("generated article HTML contains every configured topic link and reciprocal links", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");

  const rendered = new Map();
  for (const [source, links] of Object.entries(TOPIC_LINKS)) {
    const sourceHtml = fs.readFileSync(path.join(root, source), "utf8");
    const output = injectTopicClusterLinks(sourceHtml, links);
    const sectionStart = output.indexOf(MARKER);
    assert.notEqual(sectionStart, -1, `Missing generated topic section in ${source}`);
    const sectionEnd = output.indexOf("</section>", sectionStart);
    assert.notEqual(sectionEnd, -1, `Unclosed generated topic section in ${source}`);
    const section = output.slice(sectionStart, sectionEnd);
    const hrefs = new Set(
      [...section.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map(match => match[1])
    );
    for (const [, targetUrl] of links) {
      assert.ok(hrefs.has(targetUrl), `${source} output is missing configured link to ${targetUrl}`);
    }
    const sourceUrl = "/" + source.replace(/\.html$/, "");
    rendered.set(sourceUrl, hrefs);
  }

  for (const [source, links] of Object.entries(TOPIC_LINKS)) {
    const sourceUrl = "/" + source.replace(/\.html$/, "");
    for (const [, targetUrl] of links) {
      if (rendered.has(targetUrl)) {
        assert.ok(
          rendered.get(targetUrl).has(sourceUrl),
          `Rendered reciprocal link missing: ${targetUrl} -> ${sourceUrl}`
        );
      }
    }
  }
});

