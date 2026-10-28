const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const GENERATOR = path.join(__dirname, "generate-blog.js");

function fixture(t, articles) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-generator-dates-"));
  fs.mkdirSync(path.join(root, "posts"), { recursive: true });
  for (const article of articles) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: "Fixture description",
      datePublished: article.datePublished,
      ...(Object.prototype.hasOwnProperty.call(article, "dateModified") ? { dateModified: article.dateModified } : {}),
      articleSection: "General",
      url: "https://blog.matrixqr.cc/posts/" + article.file.replace(/\.html$/i, "")
    };
    fs.writeFileSync(path.join(root, "posts", article.file),
      '<!doctype html><html><head><title>' + article.title + '</title><script type="application/ld+json">' +
      JSON.stringify(schema) + '</script></head><body></body></html>');
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [GENERATOR], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, MATRIXQR_GENERATOR_ROOT: root }
  });
}

test("sorts articles by actual instant when timezone offsets differ", t => {
  const root = fixture(t, [
    { file: "older.html", title: "Older", datePublished: "2026-10-02T00:30:00+02:00" },
    { file: "newer.html", title: "Newer", datePublished: "2026-10-01T23:45:00Z" }
  ]);
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const posts = JSON.parse(fs.readFileSync(path.join(root, "posts.json"), "utf8"));
  assert.deepEqual(posts.map(post => post.title), ["Newer", "Older"]);
});

test("rejects impossible datePublished calendar dates", t => {
  const root = fixture(t, [
    { file: "invalid.html", title: "Invalid", datePublished: "2026-02-31T08:00:00+08:00" }
  ]);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid datePublished ISO datetime/);
});

test("rejects invalid dateModified instead of silently indexing it", t => {
  const root = fixture(t, [
    { file: "invalid.html", title: "Invalid", datePublished: "2026-02-28T08:00:00+08:00", dateModified: "2026-02-31T08:00:00+08:00" }
  ]);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid dateModified ISO datetime/);
});

test("falls back to datePublished when dateModified is absent", t => {
  const root = fixture(t, [
    { file: "fallback.html", title: "Fallback", datePublished: "2026-10-01T08:00:00+08:00" }
  ]);
  const result = run(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const posts = JSON.parse(fs.readFileSync(path.join(root, "posts.json"), "utf8"));
  assert.equal(posts[0].dateModified, posts[0].datePublished);
});
