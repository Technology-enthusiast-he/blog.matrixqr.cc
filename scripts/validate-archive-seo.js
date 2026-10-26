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

    return {
        file,
        html: fs.readFileSync(file, "utf8")
    };
}

function extractLink(html, rel) {
    const match = html.match(
        new RegExp(`<link\\b[^>]*\\brel=["']${rel}["'][^>]*\\bhref=["']([^"']+)["'][^>]*>`, "i")
    );
    return match ? match[1].trim() : "";
}

function extractMeta(html, attribute, key) {
    const tags = html.match(/<meta\\b[^>]*>/gi) || [];

    for (const tag of tags) {
        const attrMatch = tag.match(
            new RegExp(`\\b${attribute}=["']${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}["']`, "i")
        );

        if (!attrMatch) continue;

        const content = tag.match(/\\bcontent=["']([^"']*)["']/i);
        return content ? content[1].trim() : "";
    }

    return "";
}

function extractCollectionPageUrl(html) {
    const scripts = html.match(
        /<script\\b[^>]*type=["']application\\/ld\\+json["'][^>]*>[\\s\\S]*?<\\/script>/gi
    ) || [];

    for (const script of scripts) {
        const jsonText = script
            .replace(/^<script\\b[^>]*>/i, "")
            .replace(/<\\/script>$/i, "")
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
            // Other JSON-LD blocks may use formats unrelated to the archive.
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
    const generatedPages = [];
    const first = readArchivePage(1);
    generatedPages.push(first);

    const pageRoot = path.join(POSTS_DIR, "page");
    if (fs.existsSync(pageRoot)) {
        for (const entry of fs.readdirSync(pageRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\\d+$/.test(entry.name)) continue;
            const page = Number(entry.name);
            if (page < 2) continue;
            generatedPages.push(readArchivePage(page));
        }
    }

    generatedPages.sort((a, b) => {
        const pageA = a.file.includes(`${path.sep}page${path.sep}`)
            ? Number(a.file.match(/page[\\/]([0-9]+)[\\/]index\\.html$/)?.[1] || 1)
            : 1;
        const pageB = b.file.includes(`${path.sep}page${path.sep}`)
            ? Number(b.file.match(/page[\\/]([0-9]+)[\\/]index\\.html$/)?.[1] || 1)
            : 1;
        return pageA - pageB;
    });

    const errors = [];

    generatedPages.forEach(({ file, html }) => {
        const pageMatch = file.match(/page[\\/]([0-9]+)[\\/]index\\.html$/);
        const page = pageMatch ? Number(pageMatch[1]) : 1;
        const expected = expectedUrl(page);

        const canonical = extractLink(html, "canonical");
        const ogUrl = extractMeta(html, "property", "og:url");
        const collectionUrl = extractCollectionPageUrl(html);

        if (canonical !== expected) {
            errors.push(`${path.relative(ROOT, file)}: canonical is ${canonical || "missing"}; expected ${expected}`);
        }

        if (ogUrl !== expected) {
            errors.push(`${path.relative(ROOT, file)}: og:url is ${ogUrl || "missing"}; expected ${expected}`);
        }

        if (collectionUrl !== expected) {
            errors.push(`${path.relative(ROOT, file)}: CollectionPage.url is ${collectionUrl || "missing"}; expected ${expected}`);
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
