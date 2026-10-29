const fs = require("fs");
const path = require("path");

const ROOT = process.env.MATRIXQR_SCHEMA_ROOT ? path.resolve(process.env.MATRIXQR_SCHEMA_ROOT) : path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");

const AUTHOR = {
    "@type": "Organization",
    "name": "MatrixQR Studio",
    "url": "https://www.matrixqr.cc/",
    "sameAs": [
        "https://www.matrixqr.cc/about"
    ]
};

function walk(dir, relativeDir = "") {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.posix.join(relativeDir, entry.name).replace(/\\/g, "/").toLowerCase();

        // Generated archive and pagination pages are owned by their generators, not article normalization.
        if (relativeDir === "" && entry.isDirectory() && entry.name.toLowerCase() === "page") {
            continue;
        }

        if (entry.isDirectory()) {
            files.push(...walk(fullPath, relativePath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
            if (relativePath === "index.html" || relativePath === "privacy-policy.html") continue;
            files.push(fullPath);
        }
    }

    return files;
}

function findMatchingObjectEnd(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
        const char = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === "{") depth += 1;
        if (char === "}") {
            depth -= 1;
            if (depth === 0) return i + 1;
        }
    }

    return -1;
}

function normalizeAuthors(html) {
    const marker = '"author"';
    let searchFrom = 0;
    let replacements = 0;
    let linkedNodes = 0;

    while (true) {
        const authorIndex = html.indexOf(marker, searchFrom);
        if (authorIndex === -1) break;

        const colonIndex = html.indexOf(":", authorIndex + marker.length);
        if (colonIndex === -1) break;

        let valueStart = colonIndex + 1;
        while (/\s/.test(html[valueStart] || "")) valueStart += 1;

        if (html[valueStart] !== "{") {
            searchFrom = valueStart + 1;
            continue;
        }

        const valueEnd = findMatchingObjectEnd(html, valueStart);
        if (valueEnd === -1) {
            throw new Error(`Could not parse author object near offset ${authorIndex}.`);
        }

        const oldObject = html.slice(valueStart, valueEnd);
        const oldTypeMatch = oldObject.match(/"@type"\s*:\s*"([^"]+)"/);

        if (!oldTypeMatch || oldTypeMatch[1] !== "Person") {
            searchFrom = valueEnd;
            continue;
        }

        const replacement = JSON.stringify(AUTHOR, null, 10)
            .split("\n")
            .map((line, index) => index === 0 ? line : line.replace(/^ {10}/, ""))
            .join("\n");

        html = html.slice(0, valueStart) + replacement + html.slice(valueEnd);
        searchFrom = valueStart + replacement.length;
        replacements += 1;
    }

    return { html, replacements };
}


const SITE_ORIGIN = "https://blog.matrixqr.cc";
const WEBSITE_ID = SITE_ORIGIN + "/#website";
const ORGANIZATION_ID = SITE_ORIGIN + "/#organization";

function linkArticleEntities(html) {
    let updatedNodes = 0;
    html = html.replace(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
        (full, jsonText) => {
            let value;
            try {
                value = JSON.parse(jsonText.trim());
            } catch {
                return full;
            }

            let changed = false;
            const visit = node => {
                if (!node || typeof node !== "object") return;
                if (Array.isArray(node)) {
                    node.forEach(visit);
                    return;
                }

                const nodeTypes = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
                if (nodeTypes.some(type => ["Article", "BlogPosting", "NewsArticle"].includes(type))) {
                    const desiredPartOf = {
                        "@type": "WebSite",
                        "@id": WEBSITE_ID,
                        "url": SITE_ORIGIN + "/",
                        "name": "MatrixQR Blog"
                    };
                    if (JSON.stringify(node.isPartOf) !== JSON.stringify(desiredPartOf)) {
                        node.isPartOf = desiredPartOf;
                        changed = true;
                    }

                    const desiredPublisher = {
                        "@type": "Organization",
                        "@id": ORGANIZATION_ID,
                        "name": "MatrixQR Studio",
                        "url": "https://www.matrixqr.cc/",
                        "logo": {
                            "@type": "ImageObject",
                            "url": SITE_ORIGIN + "/favicon-64x64.png"
                        }
                    };
                    if (JSON.stringify(node.publisher) !== JSON.stringify(desiredPublisher)) {
                        node.publisher = desiredPublisher;
                        changed = true;
                    }
                    updatedNodes += 1;
                }

                if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
                if (node["@graph"] && !Array.isArray(node["@graph"])) visit(node["@graph"]);
            };

            visit(value);
            if (!changed) return full;
            return full.replace(jsonText, "\n" + JSON.stringify(value, null, 2) + "\n");
        }
    );
    return { html, updatedNodes };
}


function normalizeBreadcrumbs(html) {
    let changed = false;
    const labelsByUrl = new Map();
    const origin = SITE_ORIGIN;

    function normalizeBreadcrumbUrl(value) {
        if (typeof value !== "string") return "";
        try {
            const url = new URL(value, origin);
            if (url.origin !== origin) return "";
            return url.origin + (url.pathname.replace(/\/+$/, "") || "/");
        } catch {
            return "";
        }
    }

    html = html.replace(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
        (full, jsonText) => {
            let value;
            try {
                value = JSON.parse(jsonText.trim());
            } catch {
                return full;
            }

            let schemaChanged = false;
            const visit = node => {
                if (!node || typeof node !== "object") return;
                if (Array.isArray(node)) {
                    node.forEach(visit);
                    return;
                }
                const nodeTypes = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
                if (nodeTypes.includes("BreadcrumbList") && Array.isArray(node.itemListElement)) {
                    for (const item of node.itemListElement) {
                        const itemUrl = typeof item.item === "string"
                            ? item.item
                            : item.item && (item.item["@id"] || item.item.url);
                        const normalizedUrl = normalizeBreadcrumbUrl(itemUrl);
                        if (!normalizedUrl) continue;
                        if (normalizedUrl === origin + "/posts" && item.name !== "Posts") {
                            item.name = "Posts";
                            schemaChanged = true;
                        }
                        if (item.name) labelsByUrl.set(normalizedUrl, item.name);
                    }
                }
                if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
            };
            visit(value);
            if (!schemaChanged) return full;
            changed = true;
            return full.replace(jsonText, "\n" + JSON.stringify(value, null, 2) + "\n");
        }
    );

    const navPattern = /<nav\b(?=[^>]*\baria-label=["']Breadcrumb["'])[^>]*>[\s\S]*?<\/nav>/i;
    const navMatch = html.match(navPattern);
    if (!navMatch || labelsByUrl.size === 0) return { html, changed };

    const updatedNav = navMatch[0].replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, li => {
        const linkMatch = li.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (linkMatch) {
            const key = normalizeBreadcrumbUrl(linkMatch[1]);
            const desired = labelsByUrl.get(key);
            if (!desired) return li;
            const escaped = desired.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const updated = li.replace(linkMatch[0], linkMatch[0].replace(linkMatch[2], escaped));
            if (updated !== li) changed = true;
            return updated;
        }

        if (/\baria-current=["']page["']/i.test(li)) {
            const lastLabel = [...labelsByUrl.entries()].find(([url]) => url !== origin + "/" && url !== origin + "/posts");
            if (!lastLabel) return li;
            const escaped = lastLabel[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const updated = li.replace(/(<li\b[^>]*\baria-current=["']page["'][^>]*>)[\s\S]*?(<\/li>)/i, (match, start, end) => start + escaped + end);
            if (updated !== li) changed = true;
            return updated;
        }
        return li;
    });

    if (updatedNav !== navMatch[0]) {
        html = html.replace(navMatch[0], updatedNav);
        changed = true;
    }
    return { html, changed };
}

function main() {
    const files = walk(POSTS_DIR);
    let changedFiles = 0;
    let replacements = 0;
    let linkedNodes = 0;

    for (const file of files) {
        // This article is intentionally excluded from SEO/GEO edits.
        const relativePath = path.relative(POSTS_DIR, file).replace(/\\/g, "/").toLowerCase();
        if (relativePath === "image-to-qr-menu-guide.html") continue;

        const original = fs.readFileSync(file, "utf8");
        const authorResult = normalizeAuthors(original);
        const entityResult = linkArticleEntities(authorResult.html);
        const breadcrumbResult = normalizeBreadcrumbs(entityResult.html);
        const result = { html: breadcrumbResult.html, replacements: authorResult.replacements, linkedNodes: entityResult.updatedNodes };

        if (result.html === original) {
            continue;
        }

        fs.writeFileSync(file, result.html, "utf8");
        changedFiles += 1;
        replacements += result.replacements;
        linkedNodes += result.linkedNodes;
    }

    console.log(`[seo] Normalized ${replacements} Person author schema block(s) across ${changedFiles} article file(s).`);
    console.log(`[seo] Linked ${linkedNodes} Article/BlogPosting publisher and isPartOf relationships to stable site entities.`);
}

main();
