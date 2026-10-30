"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const GENERATOR = path.join(__dirname, "generate-xml-sitemap.js");

test("XML sitemap includes active category hubs and deduplicates canonical URLs", t => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-sitemap-"));
    t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

    fs.mkdirSync(path.join(fixture, "posts", "page", "2"), { recursive: true });
    fs.mkdirSync(path.join(fixture, "page", "2"), { recursive: true });
    fs.writeFileSync(path.join(fixture, "posts", "index.html"), "<html></html>");
    fs.writeFileSync(path.join(fixture, "posts", "page", "2", "index.html"), "<html></html>");
    fs.writeFileSync(path.join(fixture, "page", "2", "index.html"), "<html></html>");
    fs.writeFileSync(path.join(fixture, "posts.json"), JSON.stringify([
        { category: "Digital Menu & Branding", url: "https://blog.matrixqr.cc/posts/example", datePublished: "2026-10-20" },
        { category: "Digital Menu & Branding", url: "https://blog.matrixqr.cc/posts/example", dateModified: "2026-10-25" },
        { category: "General", url: "https://blog.matrixqr.cc/posts/general-guide", datePublished: "2026-10-22" },
        { category: "General", url: "https://blog.matrixqr.cc/posts/privacy-policy" },
        { category: "Unknown", url: "https://example.com/external" }
    ]));

    const run = spawnSync(process.execPath, [GENERATOR], {
        cwd: ROOT,
        env: { ...process.env, MATRIXQR_BUILD_ROOT: fixture },
        encoding: "utf8"
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    const xml = fs.readFileSync(path.join(fixture, "sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.equal(new Set(locs).size, locs.length, "sitemap URLs must be unique");
    assert.ok(locs.includes("https://blog.matrixqr.cc/category/digital-menu-branding/"));
    assert.ok(locs.includes("https://blog.matrixqr.cc/category/general/"));
    assert.ok(!locs.includes("https://blog.matrixqr.cc/category/qr-code-security-privacy/"));
    assert.ok(!locs.includes("https://blog.matrixqr.cc/category/vcard-contact-management/"));
    assert.ok(locs.includes("https://blog.matrixqr.cc/posts/page/2/"));
    assert.ok(locs.includes("https://blog.matrixqr.cc/page/2/"));
    assert.ok(!locs.some(url => url.includes("privacy-policy")));
    assert.ok(!locs.some(url => url.includes("example.com")));
    assert.match(xml, /<lastmod>2026-10-25<\/lastmod>/);
});
