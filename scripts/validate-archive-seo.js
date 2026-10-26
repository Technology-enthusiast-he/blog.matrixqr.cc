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
        throw new Error(`Archive page ${page} is missing: ${path.relative(ROOT, file)}`);
    }

    return { page, file, html: fs.readFileSync(file, "utf8") };
}

function extractLink(html, rel) {
    const pattern = new RegExp(
        "<link[^>]*rel=[\\\"']" + rel + "[\\\"'][^>]*href=[\\\"']([^\\\"']+)[\\\"'][^>]*>",
        "i"
    );
    const match = html.match(pattern);
    return match ? match[1].trim() : "";
}

function extractMeta(html, attribute, key) {
    const tags = html.match(/<meta[^>]*>/gi) || [];
    const escapedKey = key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
    const attributePattern = new RegExp("\\b" + attribute + "=[\\\"']" + escapedKey + "[\\\"']", "i");

    for (const tag of tags) {
        if (!attributePattern.test(tag)) continue;
        const content = tag.match(/content=["']([^"']*)["']/i);
        return content ? content[1].trim() : "";
    }

    return "";
}

function extractCollectionPageUrl(html) {
    const scripts = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
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
                if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
            };

            visit(data);

            for (const node of nodes) {
                const types = Array.isArray(node["@type"])
                    ? node["@type"]
                    : [node["@type"]];

                if (types.includes("CollectionPage")) {
                    return String(node.url || "").trim();
                }
            }
        } catch {
            // Ignore unrelated or malformed JSON-LD blocks; the validator will
            // report a missing CollectionPage URL if none can be parsed.
        }
    }

    return "";
}

function expectedUrl(page) {
    return page === 1
        ? `${SITE_URL}/posts/`
        : `${SITE_URL}/posts/page/${page}/`;
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
            errors.push(`${relative}: canonical is ${canonical || "missing"}; expected ${expected}`);
        }
        if (ogUrl !== expected) {
            errors.push(`${relative}: og:url is ${ogUrl || "missing"}; expected ${expected}`);
        }
        if (collectionUrl !== expected) {
            errors.push(`${relative}: CollectionPage.url is ${collectionUrl || "missing"}; expected ${expected}`);
        }
    });

    if (errors.length) {
        console.error("Archive SEO URL consistency check failed:");
        errors.forEach(error => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log(`Archive SEO URL consistency check passed for ${generatedPages.length} page(s).`);
}

main();
