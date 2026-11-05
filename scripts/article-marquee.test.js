const assert = require("node:assert/strict");
const test = require("node:test");
const { renderArticleMarquee } = require("./article-marquee");

test("renders clickable article images with escaped metadata and accessible duplicate track", () => {
    const html = renderArticleMarquee([{
        title: 'WiFi <Security> "Guide"',
        url: "https://blog.matrixqr.cc/posts/wifi-guide",
        image: "https://blog.matrixqr.cc/posts/images/wifi.webp",
        imageAlt: 'WiFi & QR "example"',
        category: "Security & Privacy"
    }]);
    assert.match(html, /<a href="\/posts\/wifi-guide"/);
    assert.match(html, /src="https:\/\/blog\.matrixqr\.cc\/posts\/images\/wifi\.webp"/);
    assert.match(html, /alt="WiFi &amp; QR &quot;example&quot;"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /tabindex="-1"/);
    assert.match(html, /fetchpriority="high"/);
    assert.match(html, /WiFi &lt;Security&gt; &quot;Guide&quot;/);
});

test("skips external article links and unsafe or missing images", () => {
    const html = renderArticleMarquee([
        { title: "External", url: "https://other.example/posts/x", image: "https://blog.matrixqr.cc/x.webp" },
        { title: "No image", url: "https://blog.matrixqr.cc/posts/no-image" },
        { title: "Unsafe image", url: "https://blog.matrixqr.cc/posts/unsafe", image: "javascript:alert(1)" }
    ]);
    assert.doesNotMatch(html, /href="\/posts\/x"/);
    assert.match(html, /Article images will appear here when available/);
    assert.doesNotMatch(html, /javascript:/i);
});

test("resolves root-relative article and image URLs", () => {
    const html = renderArticleMarquee([{ title: "Root-relative", url: "/posts/root-relative", image: "/posts/images/root.webp" }]);
    assert.match(html, /href="\/posts\/root-relative"/);
    assert.match(html, /src="https:\/\/blog\.matrixqr\.cc\/posts\/images\/root\.webp"/);
});
