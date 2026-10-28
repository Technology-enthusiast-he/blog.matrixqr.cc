"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Return article source paths relative to posts/, using one shared exclusion
 * policy for the index generator and canonical URL/path validator.
 *
 * Generated archive/pagination pages are excluded explicitly. Other HTML
 * files are treated as article sources and must satisfy the normal metadata
 * and canonical checks rather than being silently ignored.
 */
function findArticleHtmlFiles(postsDirectory) {
    const results = [];

    function walk(directory, relativeDirectory = "") {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            const relativePath = path.posix.join(relativeDirectory, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath, relativePath);
                continue;
            }

            if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) {
                continue;
            }

            const normalized = relativePath.replace(/\\\\/g, "/").toLowerCase();
            const isRootNonArticle =
                !relativeDirectory &&
                ["index.html", "privacy-policy.html"].includes(entry.name.toLowerCase());
            const isGeneratedPagination =
                normalized === "page/index.html" ||
                /^page\\/\\d+\\/index\\.html$/.test(normalized);

            if (isRootNonArticle || isGeneratedPagination) {
                continue;
            }

            results.push(relativePath);
        }
    }

    walk(postsDirectory);
    return results.sort((a, b) => a.localeCompare(b));
}

module.exports = { findArticleHtmlFiles };
