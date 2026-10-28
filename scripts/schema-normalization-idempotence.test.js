const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const NORMALIZER = path.join(__dirname, "normalize-article-schema.js");
const SYNC = path.join(__dirname, "sync-generated-page-schema.js");

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-schema-idempotence-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function run(script, root) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, MATRIXQR_SCHEMA_ROOT: root }
  });
}

function articleHtml() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "headline": "Fixture Article",
        "author": { "@type": "Person", "name": "Fixture Author" },
        "datePublished": "2026-10-01T08:00:00+08:00"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://blog.matrixqr.cc/" },
          { "@type": "ListItem", "position": 2, "name": "Articles", "item": "https://blog.matrixqr.cc/posts" },
          { "@type": "ListItem", "position": 3, "name": "Fixture Article", "item": "https://blog.matrixqr.cc/posts/fixture-article" }
        ]
      }
    ]
  };
  return '<!doctype html><html><head><script type="application/ld+json">' +
    JSON.stringify(schema) + '</script></head><body><nav aria-label="Breadcrumb"><ol>' +
    '<li><a href="/">Home</a></li><li><a href="/posts/">Articles</a></li>' +
    '<li aria-current="page">Fixture Article</li></ol></nav></body></html>';
}

function collectionHtml(title, description) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "url": "https://wrong.example/",
    "@id": "https://wrong.example/#webpage",
    "name": "Wrong title",
    "description": "Wrong description",
    "isPartOf": { "@id": "https://wrong.example/#website" },
    "publisher": { "@id": "https://wrong.example/#organization" }
  };
  return '<!doctype html><html><head><title>' + title + '</title>' +
    '<meta name="description" content="' + description + '">' +
    '<script type="application/ld+json">' + JSON.stringify(schema) +
    '</script></head><body></body></html>';
}

test("article schema normalization is idempotent and preserves the protected article", t => {
  const root = makeRoot(t);
  const articlePath = "posts/fixture-article.html";
  const protectedPath = "posts/image-to-qr-menu-guide.html";
  const article = write(root, articlePath, articleHtml());
  const protectedOriginal = '<html><head><title>Protected fixture</title></head><body>must remain byte-identical</body></html>';
  const protectedFile = write(root, protectedPath, protectedOriginal);

  const first = run(NORMALIZER, root);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const afterFirst = fs.readFileSync(article, "utf8");
  assert.notEqual(afterFirst, articleHtml(), "fixture should exercise actual normalization");
  assert.equal(fs.readFileSync(protectedFile, "utf8"), protectedOriginal);

  const second = run(NORMALIZER, root);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(fs.readFileSync(article, "utf8"), afterFirst, "second normalization must not rewrite the article");
  assert.equal(fs.readFileSync(protectedFile, "utf8"), protectedOriginal);
  assert.match(second.stdout, /across 0 article file\(s\)/);
});

test("generated CollectionPage schema synchronization is idempotent", t => {
  const root = makeRoot(t);
  const homepage = write(root, "index.html", collectionHtml("Fixture Homepage", "Homepage description"));
  const archive = write(root, "posts/index.html", collectionHtml("Fixture Archive", "Archive description"));

  const first = run(SYNC, root);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const homepageAfterFirst = fs.readFileSync(homepage, "utf8");
  const archiveAfterFirst = fs.readFileSync(archive, "utf8");
  assert.notEqual(homepageAfterFirst, collectionHtml("Fixture Homepage", "Homepage description"));
  assert.notEqual(archiveAfterFirst, collectionHtml("Fixture Archive", "Archive description"));

  const second = run(SYNC, root);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.equal(fs.readFileSync(homepage, "utf8"), homepageAfterFirst);
  assert.equal(fs.readFileSync(archive, "utf8"), archiveAfterFirst);
  assert.match(second.stdout, /on 0 generated page\(s\)/);
});
