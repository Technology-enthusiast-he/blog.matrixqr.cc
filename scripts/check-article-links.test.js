const assert = require('node:assert/strict');
const test = require('node:test');
const {
  collectMarkdownDestinations,
  maskMarkdownCode,
  normalizeMarkdownUrl,
} = require('./check-article-links');

test('extracts normal Markdown link destinations without trailing syntax', () => {
  const text = '[MatrixQR](https://www.matrixqr.cc/) and [Blog](https://blog.matrixqr.cc/posts/privacy-policy)';
  const result = collectMarkdownDestinations(text);
  assert.deepEqual(result.matches, [
    'https://www.matrixqr.cc/',
    'https://blog.matrixqr.cc/posts/privacy-policy',
  ]);
});

test('extracts image links without swallowing Markdown syntax', () => {
  const text = '![Menu](https://blog.matrixqr.cc/posts/images/Menu-QR-Code-Generator.jpg)';
  const result = collectMarkdownDestinations(text);
  assert.deepEqual(result.matches, [
    'https://blog.matrixqr.cc/posts/images/Menu-QR-Code-Generator.jpg',
  ]);
});

test('preserves balanced parentheses inside a URL', () => {
  const text = '[Example](https://example.com/path_(with-parentheses)/file)';
  const result = collectMarkdownDestinations(text);
  assert.deepEqual(result.matches, [
    'https://example.com/path_(with-parentheses)/file',
  ]);
});

test('supports escaped parentheses in Markdown destinations', () => {
  const text = '[Example](https://example.com/path_\\(test\\))';
  const result = collectMarkdownDestinations(text);
  assert.deepEqual(result.matches, [
    'https://example.com/path_(test)',
  ]);
});

test('normalizes angle-bracket destinations', () => {
  assert.equal(normalizeMarkdownUrl('<https://example.com/path>'), 'https://example.com/path');
});

test('does not include the next Markdown link in the previous URL', () => {
  const text = '[One](https://example.com/one)[Two](https://example.com/two)';
  const result = collectMarkdownDestinations(text);
  assert.deepEqual(result.matches, [
    'https://example.com/one',
    'https://example.com/two',
  ]);
});

test('masks URLs inside inline Markdown code', () => {
  const text = 'Use `https://yourdomain.com` as an example.';
  const masked = maskMarkdownCode(text);
  assert.equal(masked.includes('https://yourdomain.com'), false);
  assert.equal(masked.length, text.length);
});

test('masks URLs inside fenced Markdown code', () => {
  const text = '```\nhttps://example.com/api\n```\n';
  const masked = maskMarkdownCode(text);
  assert.equal(masked.includes('https://example.com/api'), false);
  assert.equal(masked.length, text.length);
});
