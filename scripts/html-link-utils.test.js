"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getAttributes, getLinksByRel, getLinkByRel } = require("./html-link-utils");

test("finds canonical link when href appears before rel", () => {
    const html = '<link href="https://blog.matrixqr.cc/posts/example" rel="canonical">';
    assert.equal(getLinkByRel(html, "canonical"), "https://blog.matrixqr.cc/posts/example");
});

test("matches rel tokens case-insensitively and decodes HTML entities", () => {
    const html = '<link REL="alternate CANONICAL" HREF="https://blog.matrixqr.cc/posts/example?a=1&amp;b=2">';
    assert.deepEqual(getLinksByRel(html, "canonical"), [
        "https://blog.matrixqr.cc/posts/example?a=1&b=2"
    ]);
});

test("supports single-quoted and unquoted attribute values", () => {
    assert.deepEqual(getAttributes('<link href=https://blog.matrixqr.cc/posts/example rel=canonical>'), {
        href: "https://blog.matrixqr.cc/posts/example",
        rel: "canonical"
    });
    assert.equal(getLinkByRel('<link rel=canonical href=\'https://blog.matrixqr.cc/posts/one\'>', "canonical"),
        "https://blog.matrixqr.cc/posts/one");
});

test("preserves multiple canonical tags so callers can reject ambiguity", () => {
    const html = '<link rel="canonical" href="https://blog.matrixqr.cc/a"><link href="https://blog.matrixqr.cc/b" rel="canonical">';
    assert.equal(getLinksByRel(html, "canonical").length, 2);
});
