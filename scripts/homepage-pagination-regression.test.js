const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const REPO_ROOT = path.join(__dirname, "..");
const SCRIPT_NAMES = ["article-categories.js", "update-homepage.js", "generate-pagination.js", "generate-archive.js", "generate-sitemap.js", "generate-xml-sitemap.js", "validate-pagination-seo.js"];
function runNode(script, cwd) { const result = spawnSync(process.execPath, [path.join(cwd, "scripts", script)], { cwd, encoding: "utf8" }); assert.equal(result.status, 0, `${script} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`); return result.stdout; }
function article(id, category, day) { return { title: `Article ${id}`, description: `Description for article ${id}`, datePublished: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`, dateModified: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`, category, url: `https://blog.matrixqr.cc/posts/${id}` }; }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); }
function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-regression-")); const scriptsDir = path.join(root, "scripts"); fs.mkdirSync(scriptsDir, { recursive: true });
  for (const name of SCRIPT_NAMES) fs.copyFileSync(path.join(REPO_ROOT, "scripts", name), path.join(scriptsDir, name));
  const homepage = `<!doctype html>\n<html><head><title>Fixture</title><meta name="description" content="Fixture description"><link rel="canonical" href="https://blog.matrixqr.cc/"></head>\n<body>\n<!-- Section 1: Featured & Recommendation -->\n<section id="manual-featured"><article><a href="/posts/general-11">Article general-11</a></article></section>\n<!-- AUTO-SECURITY-START -->\n<!-- AUTO-SECURITY-END -->\n<!-- AUTO-MENU-START -->\n<!-- AUTO-MENU-END -->\n<!-- Section 4: Latest Articles -->\n<section id="latest">\n<!-- AUTO-POSTS-START -->\n<!-- AUTO-POSTS-END -->\n</section>\n<div class="flex justify-center mt-12 mb-10 gap-3 flex-wrap"></div>\n<div id="external-links"><a href="https://partner.example/posts/security-a">External link with a colliding pathname</a></div>\n</body></html>`;
  fs.writeFileSync(path.join(root, "index.html"), homepage); fs.mkdirSync(path.join(root, "posts"), { recursive: true }); fs.mkdirSync(path.join(root, "templates"), { recursive: true }); fs.mkdirSync(path.join(root, "sitemap"), { recursive: true }); fs.writeFileSync(path.join(root, "sitemap", "index.html"), `<!doctype html><html><head><title>Sitemap</title></head><body><!-- AUTO-SITEMAP-START --><!-- AUTO-SITEMAP-END --></body></html>`);
  fs.writeFileSync(path.join(root, "templates", "archive-template.html.template"), `<!doctype html>\n<html><head><title>Archive</title><meta name="description" content="Archive fixture"><link rel="canonical" href="https://blog.matrixqr.cc/posts/"></head>\n<body>\n<!-- AUTO-ARCHIVE-START -->\n<!-- AUTO-ARCHIVE-END -->\n<!-- AUTO-ARCHIVE-PAGINATION-START -->\n<!-- AUTO-ARCHIVE-PAGINATION-END -->\n</body></html>`);
  const posts = [article("security-a", "QR Code Security & Privacy", 1), article("general-12", "General", 2), ...Array.from({ length: 11 }, (_, index) => article(`general-${index + 1}`, "General", index + 3))]; writeJson(path.join(root, "posts.json"), posts); return { root, posts };
}
function generatedArticleHrefs(html) { return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match => match[1].replace(/\/+$/, "").toLowerCase()).filter(href => href.startsWith("/posts/")); }

test("manual featured swap returns the removed article to automation and is idempotent", (t) => {
  const { root, posts } = createFixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); runNode("update-homepage.js", root);
  const firstRun = fs.readFileSync(path.join(root, "index.html"), "utf8"); const initialAutomatic = [firstRun.split("<!-- AUTO-SECURITY-START -->")[1].split("<!-- AUTO-SECURITY-END -->")[0], firstRun.split("<!-- AUTO-MENU-START -->")[1].split("<!-- AUTO-MENU-END -->")[0], firstRun.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0]].join("");
  assert.doesNotMatch(initialAutomatic, /href=["']\/posts\/general-11["']/i); const swappedHomepage = firstRun.replace('href="/posts/general-11">Article general-11', 'href="/posts/general-12">Article general-12'); assert.notEqual(swappedHomepage, firstRun); fs.writeFileSync(path.join(root, "index.html"), swappedHomepage);
  runNode("update-homepage.js", root); const secondRun = fs.readFileSync(path.join(root, "index.html"), "utf8"); runNode("update-homepage.js", root); const thirdRun = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.equal(thirdRun, secondRun); assert.match(secondRun, /href=["']\/posts\/general-12["']/i); assert.match(secondRun, /href=["']\/posts\/general-11["']/i); assert.match(secondRun, /href=["']\/posts\/security-a["']/i);
  const securitySection = secondRun.split("<!-- AUTO-SECURITY-START -->")[1].split("<!-- AUTO-SECURITY-END -->")[0], menuSection = secondRun.split("<!-- AUTO-MENU-START -->")[1].split("<!-- AUTO-MENU-END -->")[0], latestSection = secondRun.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0]; const automaticHrefs = [securitySection, menuSection, latestSection].join("");
  assert.doesNotMatch(automaticHrefs, /href=["']\/posts\/general-12["']/i); assert.match(automaticHrefs, /href=["']\/posts\/general-11["']/i); const allManualAndAutomatic = generatedArticleHrefs(secondRun); assert.ok(allManualAndAutomatic.includes("/posts/general-12")); assert.ok(allManualAndAutomatic.includes("/posts/general-11")); assert.ok(allManualAndAutomatic.includes("/posts/security-a")); assert.equal(posts.length, 13);
});

test("manual homepage cards do not remove articles from the archive or XML sitemap", (t) => {
  const { root, posts } = createFixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); runNode("update-homepage.js", root); runNode("generate-pagination.js", root); runNode("generate-archive.js", root); runNode("generate-xml-sitemap.js", root);
  const archivePages = [fs.readFileSync(path.join(root, "posts", "index.html"), "utf8"), fs.readFileSync(path.join(root, "posts", "page", "2", "index.html"), "utf8"), fs.readFileSync(path.join(root, "posts", "page", "3", "index.html"), "utf8")].join("\n"); const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  for (const post of posts) { const pathname = new URL(post.url).pathname; const slug = pathname.split("/").pop(); assert.match(archivePages, new RegExp(`href=["']${pathname}["']`, "i"), `archive must retain ${slug}`); assert.ok(sitemap.includes(post.url), `XML sitemap must retain ${slug}`); }
  assert.ok(fs.existsSync(path.join(root, "posts", "page", "3", "index.html")));
});

test("shrinking the article set removes obsolete generated pagination and sitemap URLs", (t) => {
  const { root, posts } = createFixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); runNode("update-homepage.js", root); runNode("generate-pagination.js", root); runNode("generate-archive.js", root); runNode("generate-xml-sitemap.js", root);
  assert.ok(fs.existsSync(path.join(root, "page", "2", "index.html"))); assert.ok(fs.existsSync(path.join(root, "posts", "page", "2", "index.html"))); const generatedHomepage = fs.readFileSync(path.join(root, "index.html"), "utf8"); assert.match(generatedHomepage, /href=["\']\/page\/2\//i); const generatedArchive = fs.readFileSync(path.join(root, "posts", "index.html"), "utf8"); assert.match(generatedArchive, /href=["\']\/posts\/page\/2\//i); assert.ok(fs.existsSync(path.join(root, "posts", "page", "3", "index.html")));
  const reducedPosts = posts.filter(post => ["general-12", "general-1", "general-2"].includes(post.url.split("/").pop())); writeJson(path.join(root, "posts.json"), reducedPosts); runNode("update-homepage.js", root); runNode("generate-pagination.js", root); runNode("generate-archive.js", root); runNode("generate-xml-sitemap.js", root);
  assert.ok(!fs.existsSync(path.join(root, "page", "2", "index.html"))); assert.ok(!fs.existsSync(path.join(root, "posts", "page", "2", "index.html"))); assert.ok(!fs.existsSync(path.join(root, "posts", "page", "3", "index.html"))); const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8"); assert.doesNotMatch(sitemap, /https:\/\/blog\.matrixqr\.cc\/(?:page\/2|posts\/page\/[23])\//); assert.match(sitemap, /https:\/\/blog\.matrixqr\.cc\//); for (const post of reducedPosts) assert.ok(sitemap.includes(post.url));
});

test("external featured link with a matching article path does not suppress pagination article", (t) => {
  const { root } = createFixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const homepagePath = path.join(root, "index.html"); let homepage = fs.readFileSync(homepagePath, "utf8"); homepage = homepage.replace('<div id="external-links"><a href="https://partner.example/posts/security-a">External link with a colliding pathname</a></div>', ""); homepage = homepage.replace('<section id="manual-featured"><article><a href="/posts/general-11">Article general-11</a></article></section>', '<section id="manual-featured"><article><a href="/posts/general-11">Article general-11</a></article><a href="https://partner.example/posts/general-10">External featured link with a matching pathname</a></section>'); fs.writeFileSync(homepagePath, homepage); runNode("update-homepage.js", root); runNode("generate-pagination.js", root); const generatedHomepage = fs.readFileSync(homepagePath, "utf8"); const latestSection = generatedHomepage.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0]; assert.match(latestSection, /href=["']\/posts\/general-10["']/i);
});

test("archive and HTML sitemap preserve source calendar dates across UTC midnight", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const boundaryPost = { ...posts[0], datePublished: "2026-10-01T00:30:00+08:00", dateModified: "2026-10-01T00:30:00+08:00" };
  writeJson(path.join(root, "posts.json"), [boundaryPost]);
  runNode("generate-archive.js", root);
  runNode("generate-sitemap.js", root);
  const archive = fs.readFileSync(path.join(root, "posts", "index.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(root, "sitemap", "index.html"), "utf8");
  assert.match(archive, /datetime="2026-10-01">2026-10-01</);
  assert.match(sitemap, /2026-10-01/);
  assert.doesNotMatch(archive, /2026-09-30/);
  assert.doesNotMatch(sitemap, /2026-09-30/);
});

test("archive pagination uses archive URLs and omits next links on the final page", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  // Thirteen articles require three archive pages. The last page must not link
  // to a fourth page, and every visible pagination target must use /posts/.
  writeJson(path.join(root, "posts.json"), posts);
  runNode("generate-archive.js", root);
  const archivePage2 = fs.readFileSync(path.join(root, "posts", "page", "2", "index.html"), "utf8");
  const archivePage3 = fs.readFileSync(path.join(root, "posts", "page", "3", "index.html"), "utf8");
  assert.match(archivePage2, /href=["']\/posts\/page\/3\//i);
  assert.doesNotMatch(archivePage2, /href=["']\/(?:page|posts\/page)\/4\//i);
  assert.doesNotMatch(archivePage2, /href=["']\/page\/3\//i);
  assert.doesNotMatch(archivePage3, /href=["']\/(?:page\/\d+|posts\/page\/4)\//i);
  assert.doesNotMatch(archivePage3, /Next\s*→/i);

  // Exactly twelve articles require two pages; page 2 must not retain Next.
  writeJson(path.join(root, "posts.json"), posts.slice(0, 12));
  runNode("generate-archive.js", root);
  const finalArchivePage = fs.readFileSync(path.join(root, "posts", "page", "2", "index.html"), "utf8");
  assert.doesNotMatch(finalArchivePage, /href=["']\/(?:page\/\d+|posts\/page\/3)\//i);
  assert.doesNotMatch(finalArchivePage, /Next\s*→/i);
  assert.ok(!fs.existsSync(path.join(root, "posts", "page", "3", "index.html")));
});


test("legacy unmarked archive pagination is removed when the article set shrinks", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeJson(path.join(root, "posts.json"), posts);
  runNode("generate-archive.js", root);
  const legacyDir = path.join(root, "posts", "page", "3");
  const legacyFile = path.join(legacyDir, "index.html");
  let legacyHtml = fs.readFileSync(legacyFile, "utf8");
  legacyHtml = legacyHtml.replace("<!-- AUTO-GENERATED-ARCHIVE-PAGE -->", "");
  fs.writeFileSync(legacyFile, legacyHtml);
  fs.writeFileSync(path.join(legacyDir, "keep.txt"), "unrelated file");

  writeJson(path.join(root, "posts.json"), posts.slice(0, 6));
  runNode("generate-archive.js", root);
  runNode("generate-xml-sitemap.js", root);

  assert.ok(!fs.existsSync(legacyFile), "obsolete unmarked archive index should be removed");
  assert.equal(fs.readFileSync(path.join(legacyDir, "keep.txt"), "utf8"), "unrelated file",
    "cleanup must preserve unrelated files in the numbered directory");
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.equal(sitemap.includes("https://blog.matrixqr.cc/posts/page/3/"), false,
    "XML sitemap must not list the obsolete archive URL");
});


test("pagination SEO validator rejects duplicate canonical link tags", (t) => {
  const { root, posts } = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeJson(path.join(root, "posts.json"), posts);
  runNode("update-homepage.js", root);
  runNode("generate-pagination.js", root);
  runNode("generate-archive.js", root);

  const pageFile = path.join(root, "page", "2", "index.html");
  let html = fs.readFileSync(pageFile, "utf8");
  const canonical = '<link rel="canonical" href="https://blog.matrixqr.cc/page/2/">';
  html = html.replace("</head>", canonical + "\n</head>");
  fs.writeFileSync(pageFile, html);

  const result = spawnSync(process.execPath, [path.join(root, "scripts", "validate-pagination-seo.js")], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0, "validator should reject duplicate canonical");
  assert.match(result.stderr, /contains 2 rel=canonical link tags/i);
});
