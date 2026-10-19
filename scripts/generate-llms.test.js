const test = require("node:test");
const assert = require("node:assert/strict");
const { markdown, meta } = require("./generate-llms");

const URL = "https://blog.matrixqr.cc/posts/test-article";

test("converts a table with thead/tbody and inline formatting", () => {
  const html = `
    <article>
      <table>
        <thead><tr><th>Feature</th><th>Menu Type</th></tr></thead>
        <tbody>
          <tr><td><strong>Access</strong></td><td>Scan &amp; view</td></tr>
          <tr><td>Updates</td><td>Change A | B</td></tr>
        </tbody>
      </table>
    </article>`;
  const output = markdown(html, URL);
  assert.match(output, /\| Feature \| Menu Type \|/);
  assert.match(output, /\| --- \| --- \|/);
  assert.match(output, /\| Access \| Scan & view \|/);
  assert.match(output, /\| Updates \| Change A \\\| B \|/);
});

test("creates a Markdown header separator when source rows only use td", () => {
  const html = "<table><tr><td>First</td><td>Second</td></tr><tr><td>A</td><td>B</td></tr></table>";
  const output = markdown(html, URL);
  assert.match(output, /\| First \| Second \|\n\| --- \| --- \|\n\| A \| B \|/);
});

test("preserves an empty cell and keeps columns aligned", () => {
  const html = "<table><tr><th>Name</th><th>Notes</th></tr><tr><td>Example</td><td></td></tr></table>";
  const output = markdown(html, URL);
  assert.match(output, /\| Name \| Notes \|\n\| --- \| --- \|\n\| Example \|\s*\|/);
});

test("does not turn a normal paragraph into a table", () => {
  const output = markdown("<p>Just a normal paragraph.</p>", URL);
  assert.equal(output, "Just a normal paragraph.");
});

test("keeps first-party MatrixQR links", () => {
  const html = '<p>Use <a href="https://www.matrixqr.cc/">MatrixQR</a> and <a href="https://blog.matrixqr.cc/posts/privacy-policy">our privacy policy</a>.</p>';
  const output = markdown(html, URL);
  assert.match(output, /\[MatrixQR\]\(https:\/\/www\.matrixqr\.cc\/\)/);
  assert.match(output, /\[our privacy policy\]\(https:\/\/blog\.matrixqr\.cc\/posts\/privacy-policy\)/);
});

test("removes third-party link destinations but keeps their anchor text", () => {
  const html = '<p>Read <a href="https://www.w3.org/TR/2dcontext/">W3C Recommendation</a> and <a href="https://gdpr.eu/data-minimisation/">GDPR.eu</a>.</p>';
  const output = markdown(html, URL);
  assert.equal(output, "Read W3C Recommendation and GDPR.eu.");
  assert.doesNotMatch(output, /https:\/\/www\.w3\.org/);
  assert.doesNotMatch(output, /https:\/\/gdpr\.eu/);
});

test("keeps parentheses in URLs inside valid Markdown link destinations", () => {
  const html = '<p>Read <a href="https://en.wikipedia.org/wiki/Phishing#QR_code_phishing_(quishing)">quishing</a>.</p>';
  const output = markdown(html, URL);
  assert.equal(output, "Read quishing.");
});

test("reads meta descriptions with apostrophes and either attribute order", () => {
  assert.equal(meta(`<meta name="description" content="Here wasn't a QR code.">`, "description"), "Here wasn't a QR code.");
  assert.equal(meta('<meta content="A second description" name="description">', "description"), "A second description");
});
