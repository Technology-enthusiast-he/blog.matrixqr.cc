"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFullUrls, extractMarkdownUrls, extractFullArticleRecords, extractArticleMetadata, compareUrlSets, normalizeUrl } = require("./validate-llms-consistency");

test("normalizes trailing slashes and rejects off-site article URLs", () => {
    assert.equal(normalizeUrl("https://blog.matrixqr.cc/posts/example/"), "https://blog.matrixqr.cc/posts/example");
    assert.equal(normalizeUrl("https://example.com/posts/example"), "");
});

test("extracts full-text article URL metadata without duplicates being hidden", () => {
    const text = "# Articles\n\n- URL: https://blog.matrixqr.cc/posts/a\n- URL: https://blog.matrixqr.cc/posts/b/\n";
    assert.deepEqual(extractFullUrls(text), [
        "https://blog.matrixqr.cc/posts/a",
        "https://blog.matrixqr.cc/posts/b"
    ]);
});

test("extracts Markdown links from llms.txt", () => {
    const text = "- [Article A](https://blog.matrixqr.cc/posts/a)\n- [Generator](https://www.matrixqr.cc/)\n";
    assert.deepEqual(extractMarkdownUrls(text), ["https://blog.matrixqr.cc/posts/a"]);
});

test("compares URL sets and reports missing and unexpected URLs", () => {
    assert.deepEqual(
        compareUrlSets(["https://blog.matrixqr.cc/posts/a", "https://blog.matrixqr.cc/posts/b"], ["https://blog.matrixqr.cc/posts/a", "https://blog.matrixqr.cc/posts/c"]),
        { missing: ["https://blog.matrixqr.cc/posts/b"], unexpected: ["https://blog.matrixqr.cc/posts/c"] }
    );
});

test("extracts per-article title and publication/update metadata from llms-full.txt", () => {
    const full = [
        "## Example article",
        "",
        "- URL: https://blog.matrixqr.cc/posts/example/",
        "- Published: 2026-10-01T00:30:00+08:00",
        "- Updated: 2026-10-02T09:00:00+08:00",
        "- Category: General",
        "",
        "Body text",
        "",
        "---",
        ""
    ].join("\n");
    assert.deepEqual(extractFullArticleRecords(full).get("https://blog.matrixqr.cc/posts/example"), {
        title: "Example article",
        published: "2026-10-01T00:30:00+08:00",
        updated: "2026-10-02T09:00:00+08:00"
    });
});

test("extracts Article JSON-LD title and dates from source HTML", () => {
    const html = '<script type="application/ld+json">{"@type":"BlogPosting","headline":"Example article","datePublished":"2026-10-01T00:30:00+08:00","dateModified":"2026-10-02T09:00:00+08:00"}</script>';
    assert.deepEqual(extractArticleMetadata(html, "example.html"), {
        title: "Example article",
        published: "2026-10-01T00:30:00+08:00",
        updated: "2026-10-02T09:00:00+08:00"
    });
});

test("uses datePublished when Article JSON-LD has no dateModified", () => {
    const html = '<script type="application/ld+json">{"@type":"Article","headline":"Example article","datePublished":"2026-10-01T00:30:00+08:00"}</script>';
    assert.deepEqual(extractArticleMetadata(html, "example.html"), {
        title: "Example article",
        published: "2026-10-01T00:30:00+08:00",
        updated: "2026-10-01T00:30:00+08:00"
    });
});
