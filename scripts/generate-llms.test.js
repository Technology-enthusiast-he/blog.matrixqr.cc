const test = require("node:test");
const assert = require("node:assert/strict");
const { markdown } = require("./generate-llms");

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
