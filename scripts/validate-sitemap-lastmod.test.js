const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const VALIDATOR = path.join(__dirname, "validate-sitemap-lastmod.js");
const ORIGIN = "https://blog.matrixqr.cc";
function fixture(postDate, lastmod) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-lastmod-test-"));
  const sitemap = path.join(root, "sitemap.xml");
  fs.writeFileSync(path.join(root, "posts.json"), JSON.stringify([{
    url: ORIGIN + "/posts/fixture/",
    datePublished: "2026-01-01T08:00:00+08:00",
    dateModified: postDate
  }]));
  fs.writeFileSync(sitemap, '<?xml version="1.0"?><urlset><url><loc>' + ORIGIN + '/posts/fixture/</loc><lastmod>' + lastmod + '</lastmod></url></urlset>');
  return { root, sitemap };
}
function run(root, sitemap) {
  return spawnSync(process.execPath, [VALIDATOR, sitemap], { cwd: root, encoding: "utf8" });
}
test("accepts a valid calendar lastmod date", t => {
  const f = fixture("2026-01-02T08:00:00+08:00", "2026-01-02");
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = run(f.root, f.sitemap);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test("rejects impossible source dateModified calendar day", t => {
  const f = fixture("2026-02-31T08:00:00+08:00", "2026-02-31");
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = run(f.root, f.sitemap);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid calendar date/);
});
test("rejects impossible sitemap lastmod calendar day", t => {
  const f = fixture("2026-02-28T08:00:00+08:00", "2026-02-31");
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = run(f.root, f.sitemap);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not valid YYYY-MM-DD calendar dates/);
});

test("rejects malformed trailing text after an otherwise valid lastmod date", t => {
  const f = fixture("2026-01-02T08:00:00+08:00", "2026-01-02not-a-date");
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const result = run(f.root, f.sitemap);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected YYYY-MM-DD/);
});
