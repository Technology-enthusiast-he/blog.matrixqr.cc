const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const REPO_ROOT = path.join(__dirname, "..");

function runNode(script, cwd) {
    const result = spawnSync(process.execPath, [path.join(cwd, "scripts", script)], { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, script + " failed.\nSTDOUT:\n" + result.stdout + "\nSTDERR:\n" + result.stderr);
}

test("homepage pagination renders clickable article images from the matching page batch", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-marquee-pagination-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scripts = path.join(root, "scripts");
    fs.mkdirSync(scripts, { recursive: true });
    for (const file of ["generate-pagination.js", "article-marquee.js"]) {
        fs.copyFileSync(path.join(REPO_ROOT, "scripts", file), path.join(scripts, file));
    }

    const posts = Array.from({ length: 20 }, (_, index) => {
        const number = index + 1;
        return {
            title: "Article " + number,
            description: "Description " + number,
            datePublished: "2026-10-" + String(20 - index).padStart(2, "0") + "T08:00:00Z",
            url: "https://blog.matrixqr.cc/posts/article-" + number,
            image: "https://blog.matrixqr.cc/posts/images/article-" + number + ".webp",
            imageAlt: "Image for article " + number,
            category: "General"
        };
    });
    fs.writeFileSync(path.join(root, "posts.json"), JSON.stringify(posts, null, 2));
    const homepage = '<!doctype html><html><head><title>Fixture</title><meta name="description" content="Fixture description"><link rel="canonical" href="https://blog.matrixqr.cc/"></head><body>' +
        '<!-- Section 1: Featured & Recommendation --><!-- Section 4: Latest Articles -->' +
        '<section aria-label="Featured article images"><!-- AUTO-ARTICLE-MARQUEE-START --><!-- AUTO-ARTICLE-MARQUEE-END --></section>' +
        '<section><!-- AUTO-POSTS-START --><!-- AUTO-POSTS-END --></section>' +
        '<div class="flex justify-center mt-12 mb-10 gap-3 flex-wrap"></div></body></html>';
    fs.writeFileSync(path.join(root, "index.html"), homepage);

    runNode("generate-pagination.js", root);

    const pageFiles = ["index.html", "page/2/index.html", "page/3/index.html", "page/4/index.html"];
    const expectedBatches = [posts.slice(0, 6), posts.slice(6, 12), posts.slice(12, 18), posts.slice(18, 24)];
    pageFiles.forEach((file, index) => {
        const html = fs.readFileSync(path.join(root, file), "utf8");
        const marquee = html.split("<!-- AUTO-ARTICLE-MARQUEE-START -->")[1].split("<!-- AUTO-ARTICLE-MARQUEE-END -->")[0];
        const primaryTrack = marquee.replace(/<div class="flex gap-6 shrink-0 pr-6" aria-hidden="true">[\s\S]*$/, "");
        const links = [...primaryTrack.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
        const expected = expectedBatches[index].map(post => new URL(post.url).pathname);
        assert.deepEqual(links, expected, file + " must show links for its own six-article batch");
        assert.match(marquee, /<img\b[^>]*src="https:\/\/blog\.matrixqr\.cc\/posts\/images\//i);
        assert.match(marquee, /aria-hidden="true"/i, "duplicate animation track must be hidden from assistive technology");
        assert.match(marquee, /tabindex="-1"/i, "duplicate links must not be keyboard-focusable");
    });
    assert.equal(fs.existsSync(path.join(root, "page", "5", "index.html")), false);
});


test("homepage generation ignores article links inside the generated marquee and remains idempotent", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-marquee-homepage-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scripts = path.join(root, "scripts");
    fs.mkdirSync(scripts, { recursive: true });
    for (const file of ["update-homepage.js", "article-categories.js"]) {
        fs.copyFileSync(path.join(REPO_ROOT, "scripts", file), path.join(scripts, file));
    }

    const posts = [
        { title: "Manual", description: "Manual", datePublished: "2026-10-01T08:00:00Z", category: "General", url: "https://blog.matrixqr.cc/posts/manual" },
        { title: "Security", description: "Security", datePublished: "2026-10-04T08:00:00Z", category: "QR Code Security & Privacy", url: "https://blog.matrixqr.cc/posts/security" },
        { title: "Menu", description: "Menu", datePublished: "2026-10-03T08:00:00Z", category: "Digital Menu & Branding", url: "https://blog.matrixqr.cc/posts/menu" },
        { title: "General", description: "General", datePublished: "2026-10-02T08:00:00Z", category: "General", url: "https://blog.matrixqr.cc/posts/general" }
    ];
    fs.writeFileSync(path.join(root, "posts.json"), JSON.stringify(posts, null, 2));
    const homepage = '<!doctype html><html><body>' +
        '<!-- Section 1: Featured & Recommendation --><section><a href="/posts/manual">Manual</a></section>' +
        '<!-- AUTO-SECURITY-START --><a href="/posts/security">Old security card</a><!-- AUTO-SECURITY-END -->' +
        '<!-- AUTO-MENU-START --><a href="/posts/menu">Old menu card</a><!-- AUTO-MENU-END -->' +
        '<!-- Section 4: Latest Articles --><!-- AUTO-POSTS-START --><a href="/posts/general">Old latest card</a><!-- AUTO-POSTS-END -->' +
        '<section><!-- AUTO-ARTICLE-MARQUEE-START -->' +
        '<a href="/posts/security">Marquee security</a><a href="/posts/menu">Marquee menu</a><a href="/posts/general">Marquee general</a>' +
        '<!-- AUTO-ARTICLE-MARQUEE-END --></section></body></html>';
    fs.writeFileSync(path.join(root, "index.html"), homepage);

    runNode("update-homepage.js", root);
    const firstBuild = fs.readFileSync(path.join(root, "index.html"), "utf8");
    runNode("update-homepage.js", root);
    const secondBuild = fs.readFileSync(path.join(root, "index.html"), "utf8");

    assert.equal(secondBuild, firstBuild, "repeated homepage generation must be byte-identical");
    const security = firstBuild.split("<!-- AUTO-SECURITY-START -->")[1].split("<!-- AUTO-SECURITY-END -->")[0];
    const menu = firstBuild.split("<!-- AUTO-MENU-START -->")[1].split("<!-- AUTO-MENU-END -->")[0];
    const latest = firstBuild.split("<!-- AUTO-POSTS-START -->")[1].split("<!-- AUTO-POSTS-END -->")[0];
    assert.match(security, /href="\/posts\/security"/);
    assert.match(menu, /href="\/posts\/menu"/);
    assert.match(latest, /href="\/posts\/general"/);
});
