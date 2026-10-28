"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFullUrls, extractMarkdownUrls, compareUrlSets, normalizeUrl } = require("./validate-llms-consistency");

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
