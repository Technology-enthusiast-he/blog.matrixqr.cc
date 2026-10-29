"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const SITE_URL = "https://blog.matrixqr.cc";
const { findArticleHtmlFiles } = require("./article-source-files");
const { getLinksByRel } = require("./html-link-utils");

function walkHtmlFiles(directory) {
    return findArticleHtmlFiles(directory).map(relativePath => ({
        fullPath: path.join(directory, relativePath),
        relativePath
    }));
}

function getCanonical(html) {
    return getLinksByRel(html, "canonical")[0] || "";
}

function main() {
    if (!fs.existsSync(POSTS_DIR)) {
        throw new Error("Posts directory not found: " + POSTS_DIR);
    }

    const files = walkHtmlFiles(POSTS_DIR);
    const errors = [];
    const canonicalToFile = new Map();

    for (const file of files) {
        const html = fs.readFileSync(file.fullPath, "utf8");
        const canonicalLinks = getLinksByRel(html, "canonical");
        if (canonicalLinks.length > 1) {
            errors.push(file.relativePath + ": multiple canonical link tags found.");
            continue;
        }
        const canonical = getCanonical(html);
        const slugPath = file.relativePath.replace(/\.html$/i, "");
        const expected = SITE_URL + "/posts/" + slugPath;

        if (!canonical) {
            errors.push(file.relativePath + ": missing canonical URL.");
            continue;
        }

        let parsed;
        try {
            parsed = new URL(canonical);
        } catch {
            errors.push(file.relativePath + ": invalid canonical URL: " + canonical);
            continue;
        }

        if (parsed.origin !== SITE_URL || parsed.pathname !== new URL(expected).pathname || parsed.search || parsed.hash) {
            errors.push(
                file.relativePath +
                ": canonical URL is " + canonical +
                "; expected " + expected +
                " based on the source file path."
            );
        }

        const normalized = canonical.replace(/\/+$/, "");
        if (canonicalToFile.has(normalized)) {
            errors.push(
                "Duplicate canonical URL " + canonical +
                " in " + canonicalToFile.get(normalized) +
                " and " + file.relativePath + "."
            );
        } else {
            canonicalToFile.set(normalized, file.relativePath);
        }
    }

    if (errors.length) {
        console.error("Article URL/path consistency check failed:");
        errors.forEach(error => console.error("  - " + error));
        process.exit(1);
    }

    console.log(
        "Article URL/path consistency check passed for " +
        files.length + " article source file(s)."
    );
}

main();
