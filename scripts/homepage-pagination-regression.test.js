const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const REPO_ROOT = path.join(__dirname, "..");
const SCRIPT_NAMES = [
  "update-homepage.js",
  "generate-pagination.js",
  "generate-archive.js",
  "generate-xml-sitemap.js",
];

function runNode(script, cwd) {
  const result = spawnSync(process.execPath, [path.join(cwd, "scripts", script)], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `${script} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  return result.stdout;
}

function article(id, category, day) {
  return {
    title: `Article ${id}`,
    description: `Description for article ${id}`,
    datePublished: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`,
    dateModified: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`,
    category,
    url: `https://blog.matrixqr.cc/posts/${id}`,
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-regression-"));
  const scriptsDir = path.join(root, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  for (const name of SCRIPT_NAMES) {
    fs.copyFileSync(path.join(REPO_ROOT, "scripts", name), path.join(scriptsDir, name));
  }

  const homepage = `<!doctype html>
<html><head><title>Fixture</title><meta name="description" content="Fixture description"><link rel="canonical" href="https://blog.matrixqr.cc/"></head>
<body>
<!-- Section 1: Featured & Recommendation -->
<section id="manual-featured"><article><a href="/posts/general-11">Article general-11</a></article></section>
<!-- AUTO-SECURITY-START -->
<!-- AUTO-SECURITY-END -->
<!-- AUTO-MENU-START -->
<!-- AUTO-MENU-END -->
<!-- Section 4: Latest Articles -->
<section id="latest">
<!-- AUTO-POSTS-START -->
<!-- AUTO-POSTS-END -->
</section>
<div class="flex justify-center mt-12 mb-10 gap-3 flex-wrap"></div>
<div id="external-links"><a href="https://partner.example/posts/security-a">External link with a colliding pathname</a></div>
</body></html>`;

  fs.writeFileSync(path.join(root, "index.html"), homepage);
  fs.mkdirSync(path.join(root, "posts"), { recursive: true });
  const archiveTemplate = `<!doctype html>
<html><head><title>Archive</title><meta name="description" content="Archive fixture"><link rel="canonical" href="https://blog.matrixqr.cc/posts/"></head>
<body>
<!-- AUTO-ARCHIVE-START -->
<!-- AUTO-ARCHIVE-END -->
<!-- AUTO-ARCHIVE-PAGINATION-START -->
<!-- AUTO-ARCHIVE-PAGINATION-END -->
</body></html>`;
  fs.writeFileSync(path.join(root, "posts", "index.html"), archiveTemplate);

  const posts = [
    article("security-a", "QR Code Security & Privacy", 1),
    article("general-12", "General", 2),
    ...Array.from({ length: 11 }, (_, index) =>
      article(`general-${index + 1}`, "General", index + 3)
    ),
  ];
  writeJson(path.join(root, "posts.json"), posts);
  return { root, posts };
}

function generatedArticleHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1].replace(/\/+$/, "").toLowerCase())
    .filter((href) => href.startsWith("/posts/"));
}

test("manual featured swap returns the removed article to automation and is idempotent", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  runNode("update-homepage.js", root);
  const firstRun = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const initialAutomatic = [
    firstRun.split("<!-- AUTO-SECURITY-START -->")[1].split("<!-- AUTO-SECURITY-END -->")[0],
    firstRun.split("<!-- AUTO-MENU-START -->")[1].split("<!-- AUTO-MENU-END -->")[0],
    firstRun.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0],
  ].join("");
  assert.doesNotMatch(initialAutomatic, /href=["']\/posts\/general-11["']/i, "the initially featured article should be excluded from automatic cards");

  const swappedHomepage = firstRun.replace(
    'href="/posts/general-11">Article general-11',
    'href="/posts/general-12">Article general-12'
  );
  assert.notEqual(swappedHomepage, firstRun, "fixture should replace the initially featured article");
  fs.writeFileSync(path.join(root, "index.html"), swappedHomepage);
  runNode("update-homepage.js", root);
  const secondRun = fs.readFileSync(path.join(root, "index.html"), "utf8");
  runNode("update-homepage.js", root);
  const thirdRun = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.equal(thirdRun, secondRun, "running the homepage generator twice after the swap should produce identical HTML");
  assert.match(secondRun, /href=["']\/posts\/general-12["']/i, "new manually featured article should remain");
  assert.match(secondRun, /href=["']\/posts\/general-11["']/i, "removed featured article should return to automatic articles");
  assert.match(secondRun, /href=["']\/posts\/security-a["']/i, "external URL with the same pathname must not suppress the automatic security article");

  const securitySection = secondRun.split("<!-- AUTO-SECURITY-START -->")[1].split("<!-- AUTO-SECURITY-END -->")[0];
  const menuSection = secondRun.split("<!-- AUTO-MENU-START -->")[1].split("<!-- AUTO-MENU-END -->")[0];
  const latestSection = secondRun.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0];
  const automaticHrefs = [securitySection, menuSection, latestSection].join("");
  assert.doesNotMatch(automaticHrefs, /href=["']\/posts\/general-12["']/i, "new manual article must not be duplicated in automatic cards");
  assert.match(automaticHrefs, /href=["']\/posts\/general-11["']/i, "removed featured article must appear in automatic cards");

  const allManualAndAutomatic = generatedArticleHrefs(secondRun);
  assert.ok(allManualAndAutomatic.includes("/posts/general-12"));
  assert.ok(allManualAndAutomatic.includes("/posts/general-11"));
  assert.ok(allManualAndAutomatic.includes("/posts/security-a"));
  assert.equal(posts.length, 13);
});

test("shrinking the article set removes obsolete generated pagination and sitemap URLs", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  runNode("update-homepage.js", root);
  runNode("generate-pagination.js", root);
  runNode("generate-archive.js", root);
  runNode("generate-xml-sitemap.js", root);

  assert.ok(fs.existsSync(path.join(root, "page", "2", "index.html")), "fixture should generate homepage page 2");
  assert.ok(fs.existsSync(path.join(root, "posts", "page", "2", "index.html")), "fixture should generate archive page 2");
  assert.ok(fs.existsSync(path.join(root, "posts", "page", "3", "index.html")), "fixture should generate archive page 3");

  const reducedPosts = posts.filter((post) =>
    ["general-12", "general-1", "general-2"].includes(post.url.split("/").pop())
  );
  writeJson(path.join(root, "posts.json"), reducedPosts);

  runNode("update-homepage.js", root);
  runNode("generate-pagination.js", root);
  runNode("generate-archive.js", root);
  runNode("generate-xml-sitemap.js", root);

  assert.ok(!fs.existsSync(path.join(root, "page", "2", "index.html")), "obsolete homepage page 2 should be removed");
  assert.ok(!fs.existsSync(path.join(root, "posts", "page", "2", "index.html")), "obsolete archive page 2 should be removed");
  assert.ok(!fs.existsSync(path.join(root, "posts", "page", "3", "index.html")), "obsolete archive page 3 should be removed");

  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /https:\/\/blog\.matrixqr\.cc\/(?:page\/2|posts\/page\/[23])\//, "XML sitemap must not retain removed pagination URLs");
  assert.match(sitemap, /https:\/\/blog\.matrixqr\.cc\//, "XML sitemap should retain the homepage");
  for (const post of reducedPosts) {
    assert.ok(sitemap.includes(post.url), `XML sitemap should retain article URL ${post.url}`);
  }
});
