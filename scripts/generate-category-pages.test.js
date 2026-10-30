"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { CATEGORY_NAMES } = require("./article-categories");
const { patchHtmlSitemapContent } = require("./generate-category-pages");

const posts = [
    { category: "General" },
    { category: "vCard & Contact Management" }
];

test("inserts category navigation once and remains stable on repeated builds", () => {
    const source = "<main>Directory</main>\n<!-- AUTO-SITEMAP-START -->\n<!-- AUTO-SITEMAP-END -->";
    const first = patchHtmlSitemapContent(source, posts);
    const second = patchHtmlSitemapContent(first, posts);
    assert.equal(second, first);
    assert.equal((first.match(/aria-label="Article categories"/g) || []).length, 1);
    assert.ok(first.includes("/category/general/"));
    assert.ok(first.includes("/category/vcard-contact-management/"));
});

test("migrates the legacy unmarked category navigation without duplicating it", () => {
    const legacy = '<nav aria-label="Article categories" class="flex flex-wrap gap-2 mb-8"><a href="/category/general/">Tech &amp; Guides</a></nav>\n<!-- AUTO-SITEMAP-START -->';
    const first = patchHtmlSitemapContent(legacy, posts);
    const second = patchHtmlSitemapContent(first, posts);
    assert.equal(second, first);
    assert.equal((first.match(/aria-label="Article categories"/g) || []).length, 1);
    assert.ok(first.includes("AUTO-CATEGORY-NAV-START"));
    assert.ok(first.includes("AUTO-CATEGORY-NAV-END"));
});

test("leaves HTML without the sitemap insertion marker unchanged", () => {
    const source = "<main>No sitemap marker</main>";
    assert.equal(patchHtmlSitemapContent(source, posts), source);
});

test("uses only canonical category labels", () => {
    assert.ok(CATEGORY_NAMES.includes("vCard & Contact Management"));
});
