const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterBareExternalUrls,
  filterExternalUrls,
  filterMarkdownLinks,
  isFirstPartyUrl,
} = require("./filter-llms-external-links");

test("recognizes MatrixQR domains as first-party", () => {
  assert.equal(isFirstPartyUrl("https://blog.matrixqr.cc/posts/example"), true);
  assert.equal(isFirstPartyUrl("https://www.matrixqr.cc/"), true);
  assert.equal(isFirstPartyUrl("https://menu.matrixqr.cc/"), true);
});

test("recognizes third-party domains as external", () => {
  assert.equal(isFirstPartyUrl("https://www.w3.org/TR/2dcontext/"), false);
  assert.equal(isFirstPartyUrl("https://gdpr.eu/data-minimisation/"), false);
});

test("removes external Markdown links but keeps anchor text", () => {
  const input = "Read [W3C Recommendation](https://www.w3.org/TR/2dcontext/) and [GDPR.eu](https://gdpr.eu/data-minimisation/).";
  const result = filterMarkdownLinks(input);
  assert.equal(result.text, "Read W3C Recommendation and GDPR.eu.");
  assert.equal(result.removed, 2);
});

test("preserves first-party Markdown links", () => {
  const input = "Use [MatrixQR](https://www.matrixqr.cc/) or [privacy policy](https://blog.matrixqr.cc/posts/privacy-policy).";
  const result = filterMarkdownLinks(input);
  assert.equal(result.text, input);
  assert.equal(result.removed, 0);
});

test("handles escaped parentheses in external URLs", () => {
  const input = "See [quishing](https://en.wikipedia.org/wiki/Phishing#QR_code_phishing_\\(quishing\\)).";
  const result = filterMarkdownLinks(input);
  assert.equal(result.text, "See quishing.");
  assert.equal(result.removed, 1);
});

test("preserves ordinary text and non-http Markdown destinations", () => {
  const input = "![Local image](/posts/images/example.webp) and [relative](/posts/example).";
  const result = filterMarkdownLinks(input);
  assert.equal(result.text, input);
  assert.equal(result.removed, 0);
});

test("removes bare third-party URLs from normal prose", () => {
  const input = "Use https://yourdomain.com and https://track.saas.com/x9z3 for testing.";
  const result = filterBareExternalUrls(input);
  assert.equal(result.text, "Use  and  for testing.");
  assert.equal(result.removed, 2);
});

test("removes bare third-party URLs from inline code", () => {
  const input = "A cloud tool may receive `https://track.saas.com/x9z3` while an example uses `https://yourdomain.com`.";
  const result = filterBareExternalUrls(input);
  assert.equal(result.text, "A cloud tool may receive `` while an example uses ``.");
  assert.equal(result.removed, 2);
});

test("preserves first-party bare URLs", () => {
  const input = "Visit https://www.matrixqr.cc/ or https://blog.matrixqr.cc/posts/privacy-policy.";
  const result = filterBareExternalUrls(input);
  assert.equal(result.text, input);
  assert.equal(result.removed, 0);
});

test("preserves punctuation after a removed external URL", () => {
  const input = "Reference: https://example.com/test, then continue.";
  const result = filterBareExternalUrls(input);
  assert.equal(result.text, "Reference: , then continue.");
  assert.equal(result.removed, 1);
});

test("filters both Markdown and bare external URLs in one pass", () => {
  const input = "Read [W3C](https://www.w3.org/TR/2dcontext/) or visit https://example.com directly.";
  const result = filterExternalUrls(input);
  assert.equal(result.text, "Read W3C or visit  directly.");
  assert.equal(result.removed, 2);
});
