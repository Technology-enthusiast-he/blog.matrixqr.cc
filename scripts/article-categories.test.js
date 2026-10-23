"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { CATEGORY_NAMES, CATEGORIES, normalizeCategory } = require("./article-categories");

test("all mapped values belong to the canonical taxonomy", () => {
  for (const [alias, category] of Object.entries(CATEGORIES)) {
    assert.ok(CATEGORY_NAMES.includes(category), alias + " maps to an unknown category");
  }
});

test("normalizes known aliases consistently", () => {
  assert.equal(CATEGORIES[normalizeCategory("Product Update")], "General");
  assert.equal(CATEGORIES[normalizeCategory("Digital Menu & Restaurant Technology")], "Digital Menu & Branding");
  assert.equal(CATEGORIES[normalizeCategory("Security")], "QR Code Security & Privacy");
  assert.equal(CATEGORIES[normalizeCategory("vCard & Contact Management")], "vCard & Contact Management");
  assert.equal(CATEGORIES[normalizeCategory("vCard & Mobile Wallet Guides")], "vCard & Contact Management");
});

test("unknown and missing categories are detectable instead of silently mapped", () => {
  const unknown = normalizeCategory("Brand New Category");
  const missing = normalizeCategory("");
  assert.equal(Object.hasOwn(CATEGORIES, unknown), false);
  assert.equal(Object.hasOwn(CATEGORIES, missing), false);
  assert.equal(CATEGORIES[unknown] || "General", "General");
  assert.equal(CATEGORIES[missing] || "General", "General");
});
