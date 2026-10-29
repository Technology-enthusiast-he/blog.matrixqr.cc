const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const validatorPath = path.join(__dirname, "validate-images.js");

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-image-validation-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "posts", "images"), { recursive: true });
    fs.writeFileSync(path.join(root, "posts", "images", "ok.webp"), "fixture");
    return root;
}

function run(root) {
    return spawnSync(process.execPath, [validatorPath], {
        encoding: "utf8",
        env: { ...process.env, IMAGE_VALIDATION_ROOT: root }
    });
}

function writeArticle(root, html) {
    fs.writeFileSync(path.join(root, "posts", "fixture.html"), html);
}

test("fails when an img element has no alt attribute", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="images/ok.webp" width="640" height="480" loading="lazy" decoding="async">');
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing an alt attribute/);
});

test("fails when a same-site image URL does not resolve to a local file", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="/posts/images/missing.webp" alt="Example" width="640" height="480" loading="lazy" decoding="async">');
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not resolve to a file/);
});

test("accepts an empty alt attribute for decorative images", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="images/ok.webp" alt="" width="640" height="480" loading="lazy" decoding="async">');
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Image validation passed/);
});

test("treats missing dimensions as a warning rather than a build error", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="images/ok.webp" alt="A useful illustration" loading="lazy" decoding="async">');
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /lacks explicit positive width and height/);
});

test("does not try to resolve external image URLs as local files", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="https://images.example.test/photo.webp" alt="External photo" width="640" height="480" loading="lazy" decoding="async">');
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Local image references checked: 0/);
});

test("resolves relative paths and HTML-encoded query strings safely", t => {
    const root = fixture(t);
    writeArticle(root, '<img src="images/ok.webp?variant=1&amp;size=large" alt="Example image" width="640" height="480" loading="lazy" decoding="async">');
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Local image references checked: 1/);
});
