"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { findArticleHtmlFiles } = require("./article-source-files");

function writeFixture(root, relativePath) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "<!doctype html><title>fixture</title>", "utf8");
}

test("article discovery excludes generated pages consistently and keeps real articles", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-article-discovery-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const included = [
        "article.html",
        "image-to-qr-menu-guide.html",
        "2026-10/nested-article.html",
        "Page/3/Story.html"
    ];
    const excluded = [
        "index.html",
        "INDEX.HTML",
        "privacy-policy.html",
        "Privacy-Policy.HTML",
        "page/index.html",
        "page/2/index.html",
        "PAGE/3/INDEX.HTML"
    ];

    for (const relativePath of [...included, ...excluded]) {
        writeFixture(root, relativePath);
    }

    const discovered = findArticleHtmlFiles(root);
    assert.deepEqual(discovered, included.slice().sort((a, b) => a.localeCompare(b)));
    for (const relativePath of excluded) {
        assert.equal(discovered.includes(relativePath), false, relativePath + " must not be indexed");
    }
});

test("missing posts directory errors are not hidden by discovery", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-article-discovery-missing-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const missing = path.join(root, "does-not-exist");
    assert.throws(() => findArticleHtmlFiles(missing), /ENOENT/);
});
