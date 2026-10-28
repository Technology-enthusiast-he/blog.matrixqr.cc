"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findArticleHtmlFiles } = require("./article-source-files");
const { getLinksByRel } = require("./html-link-utils");

const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const SHORT_FILE = path.join(ROOT, "llms.txt");
const FULL_FILE = path.join(ROOT, "llms-full.txt");

function normalizeUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "blog.matrixqr.cc") return "";
        return url.origin + (url.pathname.replace(/\/+$/, "") || "/");
    } catch {
        return "";
    }
}

function extractFullUrls(content) {
    return [...content.matchAll(/^- URL: (https?:\/\/\S+)$/gm)]
        .map(match => normalizeUrl(match[1]))
        .filter(Boolean);
}

function extractMarkdownUrls(content) {
    return [...content.matchAll(/\]\((https?:\/\/[^)]+)\)/g)]
        .map(match => normalizeUrl(match[1]))
        .filter(Boolean);
}

function canonicalUrlFromHtml(html, relativePath) {
    const match = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    if (!match) throw new Error(relativePath + ": missing canonical URL.");
    const url = normalizeUrl(match[1]);
    if (!url) throw new Error(relativePath + ": invalid or off-site canonical URL.");
    return url;
}

function duplicates(values) {
    const seen = new Set();
    const repeated = new Set();
    for (const value of values) {
        if (seen.has(value)) repeated.add(value);
        seen.add(value);
    }
    return [...repeated];
}

function compareUrlSets(expected, actual) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    return {
        missing: [...expectedSet].filter(url => !actualSet.has(url)).sort(),
        unexpected: [...actualSet].filter(url => !expectedSet.has(url)).sort()
    };
}

function validate({ root = ROOT, sourceFiles, shortContent, fullContent } = {}) {
    const postsDir = path.join(root, "posts");
    const short = shortContent ?? fs.readFileSync(path.join(root, "llms.txt"), "utf8");
    const full = fullContent ?? fs.readFileSync(path.join(root, "llms-full.txt"), "utf8");
    const files = sourceFiles ?? findArticleHtmlFiles(postsDir);
    const expected = files.map(relativePath => {
        const html = fs.readFileSync(path.join(postsDir, relativePath), "utf8");
        return canonicalUrlFromHtml(html, relativePath);
    });
    const fullUrls = extractFullUrls(full);
    const shortUrls = extractMarkdownUrls(short);
    const errors = [];

    const duplicateSource = duplicates(expected);
    const duplicateFull = duplicates(fullUrls);
    if (duplicateSource.length) errors.push("Duplicate canonical article URL(s) in source files: " + duplicateSource.join(", "));
    if (duplicateFull.length) errors.push("Duplicate article URL(s) in llms-full.txt: " + duplicateFull.join(", "));

    const fullComparison = compareUrlSets(expected, fullUrls);
    if (fullComparison.missing.length) errors.push("llms-full.txt is missing source article URL(s): " + fullComparison.missing.join(", "));
    if (fullComparison.unexpected.length) errors.push("llms-full.txt contains URL(s) that are not article sources: " + fullComparison.unexpected.join(", "));

    const shortComparison = compareUrlSets(fullUrls, shortUrls);
    if (shortComparison.missing.length) errors.push("llms.txt is missing article URL(s) present in llms-full.txt: " + shortComparison.missing.join(", "));

    return { errors, sourceCount: expected.length, fullCount: fullUrls.length, shortArticleCoverage: fullUrls.length - shortComparison.missing.length };
}

if (require.main === module) {
    try {
        const result = validate();
        if (result.errors.length) throw new Error(result.errors.join("\n"));
        console.log("[llms] PASS: llms-full.txt exactly covers all " + result.sourceCount + " article source URLs.");
        console.log("[llms] PASS: llms.txt links to every article included in llms-full.txt (" + result.shortArticleCoverage + " URLs).");
    } catch (error) {
        console.error("[llms] CONSISTENCY CHECK FAILED: " + error.message);
        process.exit(1);
    }
}

module.exports = { normalizeUrl, extractFullUrls, extractMarkdownUrls, compareUrlSets, validate };
