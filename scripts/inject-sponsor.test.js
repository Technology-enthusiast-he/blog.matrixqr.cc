const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { injectSponsor, walk } = require("./inject-sponsor");

test("inserts a single Sponsor link immediately before the footer", () => {
    const source = "<html><body><main>Content</main><footer>Footer</footer></body></html>";
    const result = injectSponsor(source);

    assert.ok(result.indexOf('aria-label="Sponsor"') < result.indexOf("<footer>"));
    assert.doesNotMatch(result, /<h[1-6][^>]*>Sponsor<\/h[1-6]>/);
    assert.match(result, /href="https:\/\/replikasaatblog\.com\/"[^>]*rel="sponsored noopener noreferrer"/);
    assert.match(result, /<a[^>]*>\s*Sponsor\s*<span aria-hidden="true">↗<\/span>\s*<\/a>/);
    assert.doesNotMatch(result, /replikasaatblog\.com<\/a>/);
});

test("is idempotent and does not duplicate the Sponsor block", () => {
    const once = injectSponsor("<html><body><footer>Footer</footer></body></html>");
    const twice = injectSponsor(once);

    assert.equal(twice, once);
    assert.equal((twice.match(/SITE-SPONSOR-START/g) || []).length, 1);
});

test("adds the Sponsor block to site HTML but preserves the protected article byte-for-byte", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrixqr-sponsor-"));
    try {
        fs.mkdirSync(path.join(root, "posts"), { recursive: true });
        const regular = path.join(root, "index.html");
        const protectedFile = path.join(root, "posts", "image-to-qr-menu-guide.html");
        const regularSource = "<html><body><footer>Footer</footer></body></html>";
        const protectedSource = "<html><body><footer>Protected Footer</footer></body></html>";

        fs.writeFileSync(regular, regularSource);
        fs.writeFileSync(protectedFile, protectedSource);

        const result = walk(root);

        assert.equal(result.changed, 1);
        assert.match(fs.readFileSync(regular, "utf8"), /SITE-SPONSOR-START/);
        assert.equal(fs.readFileSync(protectedFile, "utf8"), protectedSource);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("leaves an HTML document without a footer or body closing tag unchanged", () => {
    const source = "<html><head></head><body><main>Content</main>";
    assert.equal(injectSponsor(source), source);
});
