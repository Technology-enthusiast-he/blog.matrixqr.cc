const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MARKER,
  TOPIC_LINKS,
  ARTICLE_CATEGORY_URLS,
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
  assert.ok(urls.has("/posts/custom-qr-code-generator-logo"));
  assert.ok(urls.has("/posts/how-to-add-logo-to-qr-code-without-breaking-it"));
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
    const output = injectTopicClusterLinks(sourceHtml, links, ARTICLE_CATEGORY_URLS[source]);
    const sectionStart = output.indexOf(MARKER);
    assert.notEqual(sectionStart, -1, `Missing generated topic section in ${source}`);
    const sectionEnd = output.indexOf("</section>", sectionStart);
    assert.notEqual(sectionEnd, -1, `Unclosed generated topic section in ${source}`);
    const section = output.slice(sectionStart, sectionEnd);
    const bodyHtml = output.slice(output.indexOf("<article"), sectionStart);
    const bodyMatches = [...bodyHtml.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)];
    const sectionMatches = [...section.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)];
    const normalize = value => value.replace(/^https?:\/\/blog\.matrixqr\.cc/i, "").replace(/\/+$/, "").replace(/\.html$/i, "");
    const allArticleHrefs = new Set([...bodyMatches, ...sectionMatches].map(match => normalize(match[1])));
    const sectionHrefs = new Set(sectionMatches.map(match => normalize(match[1])));
    for (const [, targetUrl] of links) {
      const normalized = normalize(targetUrl);
      const alreadyInBody = bodyMatches.some(match => normalize(match[1]) === normalized);
      assert.ok(allArticleHrefs.has(normalized), source + " output is missing configured link to " + targetUrl);
      if (alreadyInBody) assert.ok(!sectionHrefs.has(normalized), source + " repeats a body link in generated Related Guides: " + targetUrl);
    }
    const sourceUrl = "/" + source.replace(/\.html$/, "");
    rendered.set(sourceUrl, allArticleHrefs);
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


 
test("every configured article links to its canonical category hub", () => {
  assert.deepEqual(Object.keys(ARTICLE_CATEGORY_URLS).sort(), Object.keys(TOPIC_LINKS).sort());
  for (const [source, category] of Object.entries(ARTICLE_CATEGORY_URLS)) {
    assert.ok(category[0].startsWith("/category/") && category[0].endsWith("/"), source + " category URL must be canonical");
    const output = injectTopicClusterLinks("<article><p>Article</p></article>", TOPIC_LINKS[source], category);
    assert.ok(output.includes('href="' + category[0] + '"'), source + " missing category hub link");
    assert.ok(output.includes(">Explore " + category[1] + "</a>"), source + " missing descriptive category anchor");
  }
});

test("does not repeat article targets already linked in article body", () => {
  const source = '<article><p><a href="/posts/static-vs-dynamic-qr">Static and dynamic QR codes</a></p></article>';
  const updated = injectTopicClusterLinks(source, [["Static vs dynamic QR codes", "/posts/static-vs-dynamic-qr"], ["vCard QR setup", "/posts/vcard-qr-setup"]]);
  const section = updated.slice(updated.indexOf(MARKER));
  assert.doesNotMatch(section, /href="\/posts\/static-vs-dynamic-qr"/);
  assert.match(section, /href="\/posts\/vcard-qr-setup"/);
});

test("recognizes absolute same-site URLs and ignores navigation outside article content", () => {
  const source = '<nav><a href="/posts/static-vs-dynamic-qr">Navigation</a></nav><article><p><a href="https://blog.matrixqr.cc/posts/static-vs-dynamic-qr/">Contextual link</a></p></article>';
  const updated = injectTopicClusterLinks(source, [["Static vs dynamic QR codes", "/posts/static-vs-dynamic-qr"], ["vCard QR setup", "/posts/vcard-qr-setup"]]);
  const section = updated.slice(updated.indexOf(MARKER));
  assert.doesNotMatch(section, /href="\/posts\/static-vs-dynamic-qr"/);
  assert.match(section, /href="\/posts\/vcard-qr-setup"/);
});

test("keeps the category hub link when every article recommendation is already linked", () => {
  const source = '<article><p><a href="/posts/static-vs-dynamic-qr">Static and dynamic QR codes</a></p></article>';
  const updated = injectTopicClusterLinks(source, [["Static vs dynamic QR codes", "/posts/static-vs-dynamic-qr"]], ["/category/general/", "General QR Code Guides"]);
  const section = updated.slice(updated.indexOf(MARKER));
  assert.match(section, /href="\/category\/general\/"/);
  assert.doesNotMatch(section, /href="\/posts\/static-vs-dynamic-qr"/);
});
