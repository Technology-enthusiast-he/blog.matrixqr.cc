"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const SITE_URL = "https://blog.matrixqr.cc";

function readArchivePage(page) {
    const file = page === 1
        ? path.join(POSTS_DIR, "index.html")
        : path.join(POSTS_DIR, "page", String(page), "index.html");

    if (!fs.existsSync(file)) {
        throw new Error("Archive page " + page + " is missing: " + path.relative(ROOT, file));
    }

    return { page, file, html: fs.readFileSync(file, "utf8") };
}

function getAttribute(tag, attribute) {
    const match = tag.match(new RegExp("\\b" + attribute + "=[\\\"']([^\\\"']*)[\\\"']", "i"));
    return match ? match[1].trim() : "";
}

function extractLink(html, rel) {
    const tags = html.match(/<link\b[^>]*>/gi) || [];
    for (const tag of tags) {
        if (getAttribute(tag, "rel").toLowerCase() === rel.toLowerCase()) {
            return getAttribute(tag, "href");
        }
    }
    return "";
}

function extractMeta(html, attribute, key) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
        if (getAttribute(tag, attribute).toLowerCase() === key.toLowerCase()) {
            return getAttribute(tag, "content");
        }
    }
    return "";
}

function extractCollectionPageUrl(html) {
    const scripts = html.match(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) || [];

    for (const script of scripts) {
        const jsonText = script
            .replace(/^<script[^>]*>/i, "")
            .replace(/<\/script>$/i, "")
            .trim();

        try {
            const data = JSON.parse(jsonText);
            const nodes = [];

            const visit = value => {
                if (!value || typeof value !== "object") return;
                if (Array.isArray(value)) {
                    value.forEach(visit);
                    return;
                }
                nodes.push(value);
                for (const nested of Object.values(value)) {
                    if (nested && typeof nested === "object") visit(nested);
                }
            };

            visit(data);

            for (const node of nodes) {
                const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
                if (types.includes("CollectionPage")) return String(node.url || "").trim();
            }
        } catch {
            // Report a missing CollectionPage URL if no valid node can be parsed.
        }
    }

    return "";
}

function expectedUrl(page) {
    return page === 1
        ? SITE_URL + "/posts/"
        : SITE_URL + "/posts/page/" + page + "/";
}

function main() {
    const generatedPages = [readArchivePage(1)];
    const pageRoot = path.join(POSTS_DIR, "page");

    if (fs.existsSync(pageRoot)) {
        for (const entry of fs.readdirSync(pageRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
            const page = Number(entry.name);
            if (page >= 2) generatedPages.push(readArchivePage(page));
        }
    }

    generatedPages.sort((a, b) => a.page - b.page);
    const errors = [];

    generatedPages.forEach(({ page, file, html }) => {
        const expected = expectedUrl(page);
        const relative = path.relative(ROOT, file);
        const canonical = extractLink(html, "canonical");
        const ogUrl = extractMeta(html, "property", "og:url");
        const collectionUrl = extractCollectionPageUrl(html);

        if (canonical !== expected) {
            errors.push(relative + ": canonical is " + (canonical || "missing") + "; expected " + expected);
        }
        if (ogUrl !== expected) {
            errors.push(relative + ": og:url is " + (ogUrl || "missing") + "; expected " + expected);
        }
        if (collectionUrl !== expected) {
            errors.push(relative + ": CollectionPage.url is " + (collectionUrl || "missing") + "; expected " + expected);
        }
    });

    if (errors.length) {
        console.error("Archive SEO URL consistency check failed:");
        errors.forEach(error => console.error("- " + error));
        process.exit(1);
    }

    console.log("Archive SEO URL consistency check passed for " + generatedPages.length + " page(s).");
}

main();
