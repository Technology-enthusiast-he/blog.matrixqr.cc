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
    const canonicals = getLinksByRel(html, "canonical");
    if (canonicals.length === 0) throw new Error(relativePath + ": missing canonical URL.");
    if (canonicals.length > 1) throw new Error(relativePath + ": has multiple canonical link tags.");
    const url = normalizeUrl(canonicals[0]);
    if (!url) throw new Error(relativePath + ": invalid or off-site canonical URL.");
    return url;
}

function extractFullArticleRecords(content) {
    const records = new Map();
    const pattern = /^## (.+)\r?\n\r?\n- URL: (https?:\/\/\S+)\r?\n- Published: (\S+)\r?\n- Updated: (\S+)\r?\n- Category: (.+)$/gm;
    for (const match of content.matchAll(pattern)) {
        const url = normalizeUrl(match[2]);
        if (!url) continue;
        records.set(url, {
            title: match[1].trim(),
            published: match[3].trim(),
            updated: match[4].trim()
        });
    }
    return records;
}

function extractArticleMetadata(html, relativePath) {
    const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts) {
        let root;
        try { root = JSON.parse(script[1].trim()); } catch { continue; }
        const stack = [root];
        while (stack.length) {
            const node = stack.pop();
            if (Array.isArray(node)) {
                stack.push(...node);
                continue;
            }
            if (!node || typeof node !== "object") continue;
            if (Array.isArray(node["@graph"])) stack.push(...node["@graph"]);
            const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            if (types.some(type => ["Article", "BlogPosting", "NewsArticle"].includes(type))) {
                const title = String(node.headline || "").trim();
                const published = String(node.datePublished || "").trim();
                const updated = String(node.dateModified || node.datePublished || "").trim();
                if (!title || !published || !updated) {
                    throw new Error(relativePath + ": Article JSON-LD is missing headline/datePublished/dateModified.");
                }
                return { title, published, updated };
            }
        }
    }
    throw new Error(relativePath + ": no Article/BlogPosting JSON-LD metadata found.");
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
    const sourceRecords = files.map(relativePath => {
        const html = fs.readFileSync(path.join(postsDir, relativePath), "utf8");
        return {
            url: canonicalUrlFromHtml(html, relativePath),
            ...extractArticleMetadata(html, relativePath),
            relativePath
        };
    });
    const expected = sourceRecords.map(record => record.url);
    const fullUrls = extractFullUrls(full);
    const fullRecords = extractFullArticleRecords(full);
    const shortUrls = extractMarkdownUrls(short);
    const errors = [];

    const duplicateSource = duplicates(expected);
    const duplicateFull = duplicates(fullUrls);
    if (duplicateSource.length) errors.push("Duplicate canonical article URL(s) in source files: " + duplicateSource.join(", "));
    if (duplicateFull.length) errors.push("Duplicate article URL(s) in llms-full.txt: " + duplicateFull.join(", "));

    const fullComparison = compareUrlSets(expected, fullUrls);
    if (fullComparison.missing.length) errors.push("llms-full.txt is missing source article URL(s): " + fullComparison.missing.join(", "));
    if (fullComparison.unexpected.length) errors.push("llms-full.txt contains URL(s) that are not article sources: " + fullComparison.unexpected.join(", "));

    for (const source of sourceRecords) {
        const record = fullRecords.get(source.url);
        if (!record) {
            errors.push("llms-full.txt is missing metadata for source article: " + source.url);
            continue;
        }
        if (record.title !== source.title) {
            errors.push("llms-full.txt title mismatch for " + source.url + ": expected " + JSON.stringify(source.title) + ", got " + JSON.stringify(record.title));
        }
        if (record.published !== source.published) {
            errors.push("llms-full.txt Published mismatch for " + source.url + ": expected " + source.published + ", got " + record.published);
        }
        if (record.updated !== source.updated) {
            errors.push("llms-full.txt Updated mismatch for " + source.url + ": expected " + source.updated + ", got " + record.updated);
        }
    }

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

module.exports = { normalizeUrl, extractFullUrls, extractMarkdownUrls, extractFullArticleRecords, extractArticleMetadata, compareUrlSets, validate };
