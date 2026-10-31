"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
    extractAnchors,
    getArticleContent,
    getRelatedContent,
    runAudit
} = require("./validate-internal-links");

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-internal-links-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "posts"), { recursive: true });
    fs.writeFileSync(path.join(root, "index.html"), "<html><body><a href='/posts/one'>Home</a></body></html>");
    return root;
}

function article(root, name, body) {
    const file = path.join(root, "posts", name + ".html");
    fs.writeFileSync(file, "<html><body><article>" + body + "</article></body></html>");
}

test("extracts visible and accessible anchor names including image alt", () => {
    const anchors = extractAnchors(
        '<a href="/a">  Read <strong>this</strong> </a>' +
        '<a href="/b" aria-label="Contact guide"></a>' +
        '<a href="/c"><img src="/x.png" alt="QR code guide"></a>'
    );
    assert.equal(anchors[0].accessibleName, "Read this");
    assert.equal(anchors[1].accessibleName, "Contact guide");
    assert.equal(anchors[2].accessibleName, "QR code guide");
});

test("separates article body links from generated Related Guides links", () => {
    const html = '<article><p><a href="/posts/other">Useful guide</a></p>' +
        '<!-- SEO/GEO Topic Cluster Links --><section><a href="/posts/third">Third guide</a></section></article>';
    assert.match(getArticleContent(html), /Useful guide/);
    assert.doesNotMatch(getArticleContent(html), /Third guide/);
    assert.match(getRelatedContent(html), /Third guide/);
});

test("counts independent source pages, not repeated links from one source", (t) => {
    const root = fixture(t);
    article(root, "one",
        '<p><a href="/posts/two">Two guide</a><a href="/posts/two">Another Two link</a></p>' +
        '<!-- SEO/GEO Topic Cluster Links --><section><a href="/posts/two">Two guide again</a></section>');
    article(root, "two", '<p><a href="/posts/one">One guide</a></p>');
    const report = runAudit(root);
    assert.equal(report.inboundSourceCounts["posts/two.html"], 1);
    assert.equal(report.inboundSourceCounts["posts/one.html"], 1);
    assert.ok(report.findings.some(item => item.includes("posts/one.html links to posts/two.html 3 times")));
});

test("reports missing targets, empty anchors, and generic anchors", (t) => {
    const root = fixture(t);
    article(root, "one",
        '<p><a href="/posts/missing">Missing target</a>' +
        '<a href="/posts/two"></a>' +
        '<a href="/posts/two">Read more</a></p>');
    article(root, "two", '<p>Content without article links.</p>');
    const report = runAudit(root);
    assert.ok(report.findings.some(item => item.includes("has no local HTML target")));
    assert.ok(report.findings.some(item => item.includes("no accessible anchor name")));
    assert.ok(report.findings.some(item => item.includes('generic anchor "Read more"')));
    assert.ok(report.findings.some(item => item.includes("no internal link to another article")));
});

test("does not count external, fragment, mail, or self links as article links", (t) => {
    const root = fixture(t);
    article(root, "one",
        '<p><a href="https://example.com">External</a><a href="#faq">FAQ</a>' +
        '<a href="mailto:test@example.com">Email</a><a href="/posts/one">Self</a></p>');
    const report = runAudit(root);
    assert.equal(report.bodyArticleLinks, 0);
    assert.equal(report.relatedArticleLinks, 0);
});

test("protects the excluded image-to-qr-menu-guide article from missing-link warnings", (t) => {
    const root = fixture(t);
    article(root, "image-to-qr-menu-guide", "<p>Protected content.</p>");
    const report = runAudit(root);
    assert.equal(report.findings.some(item => item.includes("image-to-qr-menu-guide.html: no internal link")), false);
});
