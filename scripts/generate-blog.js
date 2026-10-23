const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const OUTPUT_FILE = path.join(ROOT, "posts.json");

const SITE_URL = "https://blog.matrixqr.cc";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function decodeHtmlEntities(str = "") {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function getMetaContent(html, name) {
    for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
        const tag = match[0];
        const attrs = {};
        for (const attr of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
            attrs[attr[1].toLowerCase()] = attr[3];
        }
        if ((attrs.name || "").toLowerCase() === name.toLowerCase() && attrs.content !== undefined) {
            return decodeHtmlEntities(attrs.content);
        }
    }
    return "";
}
function getCanonical(html) {
    const match = html.match(
        /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
    );

    return match ? match[1] : "";
}

function getTitle(html) {
    const match = html.match(/<title>([\s\S]*?)<\/title>/i);

    return match
        ? decodeHtmlEntities(match[1].trim())
        : "";
}

function getJsonLd(html) {
    const matches = [
        ...html.matchAll(
            /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
        )
    ];

    for (const match of matches) {
        try {
            const json = JSON.parse(match[1].trim());

            if (Array.isArray(json)) {
                const article = json.find(
                    item =>
                        item &&
                        (
                            item["@type"] === "BlogPosting" ||
                            item["@type"] === "Article"
                        )
                );

                if (article) return article;
            }

            if (
                json &&
                (
                    json["@type"] === "BlogPosting" ||
                    json["@type"] === "Article"
                )
            ) {
                return json;
            }

            // Handle @graph
            if (json && Array.isArray(json["@graph"])) {
                const article = json["@graph"].find(
                    item =>
                        item &&
                        (
                            item["@type"] === "BlogPosting" ||
                            item["@type"] === "Article"
                        )
                );

                if (article) return article;
            }
        } catch (error) {
            // Ignore invalid JSON-LD blocks
        }
    }

    return null;
}

// --------------------------------------------------
// Read posts
// --------------------------------------------------

if (!fs.existsSync(POSTS_DIR)) {
    console.error("ERROR: posts directory not found:");
    console.error(POSTS_DIR);
    process.exit(1);
}


function findHtmlFiles(dir, relativeDir = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.posix.join(relativeDir, entry.name);

        if (entry.isDirectory()) {
            results.push(...findHtmlFiles(fullPath, relativePath));
            continue;
        }

        if (
            entry.isFile() &&
            entry.name.toLowerCase().endsWith(".html")
        ) {
            // Skip archive pages and other non-article pages.
const normalizedPath = relativePath
    .replace(/\\/g, "/")
    .toLowerCase();

if (
    (
        relativeDir === "" &&
        ["index.html", "privacy-policy.html"].includes(
            entry.name.toLowerCase()
        )
    ) ||
    normalizedPath === "page/index.html" ||
    /^page\/\d+\/index\.html$/.test(normalizedPath)
) {
    continue;
}


            results.push(relativePath);
        }
    }

    return results;
}

const files = findHtmlFiles(POSTS_DIR);


const posts = [];
const skippedPosts = [];
const warnings = [];
const sourceCategoryCounts = new Map();
const outputCategoryCounts = new Map();
const canonicalUrlFiles = new Map();

for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const html = fs.readFileSync(filePath, "utf8");

    const jsonLd = getJsonLd(html);

    const title =
        (jsonLd && jsonLd.headline) ||
        getTitle(html);

    // The HTML meta description is the canonical editorial source. JSON-LD is a fallback.
    const description =
        getMetaContent(html, "description") ||
        (jsonLd && jsonLd.description) ||
        "";

    const datePublished =
        jsonLd && jsonLd.datePublished
            ? jsonLd.datePublished
            : "";

    const dateModified =
        jsonLd && jsonLd.dateModified
            ? jsonLd.dateModified
            : datePublished;

    
const rawCategory =
    jsonLd && jsonLd.articleSection
        ? jsonLd.articleSection.trim().toLowerCase()
        : "general";
        
    sourceCategoryCounts.set(
        rawCategory,
        (sourceCategoryCounts.get(rawCategory) || 0) + 1
    );

    if (!jsonLd) {
        warnings.push(file + ": no Article/BlogPosting JSON-LD found; fallback metadata and General category may be used.");
    }

    if (!description.trim()) {
        warnings.push(file + ": missing meta description and JSON-LD description.");
    }

    if (datePublished && Number.isNaN(Date.parse(datePublished))) {
        warnings.push(file + ": invalid datePublished value \"" + datePublished + "\".");
    }

let category = "General";

if (
    [
        "security",
        "security tech",
        "privacy",
        "privacy tech",
        "client side",
        "client side privacy",
        "security & privacy",
        "qr code security & privacy"
    ].includes(rawCategory)
) {
    category = "QR Code Security & Privacy";
} else if (
    [
        "restaurant",
        "digital menu",
        "digital menus",
        "digital menu & restaurant technology",
        "branding",
        "branding guide",
        "custom logo",
        "custom qr",
        "menu",
        "digital menu & branding"
    ].includes(rawCategory)
) {
    category = "Digital Menu & Branding";
} else if (
    [
        "vcard",
        "vcard & contact management",
        "contact",
        "contact management"
    ].includes(rawCategory)
) {
    category = "vCard & Contact Management";
}


    const canonical =
        getCanonical(html) ||
        `${SITE_URL}/posts/${file.replace(/\.html$/i, "")}`;

    if (!title || !datePublished) {
        const reason = [
            !title ? "missing title" : "",
            !datePublished ? "missing datePublished" : ""
        ].filter(Boolean).join(" and ");
        skippedPosts.push({ file, reason });
        console.warn(`SKIPPED: ${file} — ${reason}`);
        continue;
    }

    const normalizedCanonical = canonical.trim().replace(/\/+$/, "").toLowerCase();
    if (canonicalUrlFiles.has(normalizedCanonical)) {
        warnings.push(`duplicate canonical URL "${canonical}" in ${canonicalUrlFiles.get(normalizedCanonical)} and ${file}.`);
    } else {
        canonicalUrlFiles.set(normalizedCanonical, file);
    }

    posts.push({
        title: title.trim(),
        description: description.trim(),
        datePublished,
        dateModified,
        category,
        url: canonical
    });

    outputCategoryCounts.set(
        category,
        (outputCategoryCounts.get(category) || 0) + 1
    );
}

// --------------------------------------------------
// Sort newest first
// --------------------------------------------------

posts.sort(
    (a, b) =>
        new Date(b.datePublished) -
        new Date(a.datePublished)
);

// --------------------------------------------------
// Create data directory
// --------------------------------------------------



// Fail the build if any source HTML article was silently omitted from posts.json.
// A skipped article would otherwise disappear from generated archives, pagination,
// internal indexes, and the XML sitemap without failing the deployment.
if (skippedPosts.length > 0) {
    console.error("ERROR: One or more HTML files under posts/ could not be indexed:");
    for (const post of skippedPosts) {
        console.error(`  - ${post.file}: ${post.reason}`);
    }
    console.error("Fix the missing title/datePublished metadata or explicitly exclude non-article HTML files in findHtmlFiles().");
    process.exit(1);
}

// --------------------------------------------------
// Write posts.json
// --------------------------------------------------

fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(posts, null, 2),
    "utf8"
);

// --------------------------------------------------
// Report
// --------------------------------------------------

console.log("");
console.log("======================================");
console.log(" MatrixQR Blog Post Index Generator");
console.log("======================================");
console.log("");
console.log(`Posts directory: ${POSTS_DIR}`);
console.log(`Posts found:     ${files.length}`);
console.log(`Posts indexed:   ${posts.length}`);
console.log(`Posts skipped:   ${skippedPosts.length}`);
console.log(`Metadata warnings: ${warnings.length}`);
console.log(`Output:          ${OUTPUT_FILE}`);
console.log("");

console.log("Output category distribution:");
for (const [category, count] of [...outputCategoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  - ${category}: ${count}`);
}

console.log("");
console.log("Source articleSection distribution:");
for (const [category, count] of [...sourceCategoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  - ${category}: ${count}`);
}

if (warnings.length) {
    console.log("");
    console.warn("Warnings to review:");
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
}

if (posts.length > 0) {
    console.log("Newest posts:");

    posts.slice(0, 10).forEach((post, index) => {
        console.log(
            `${index + 1}. ${post.datePublished} - ${post.title}`
        );
    });
}

console.log("");
console.log("Done.");
