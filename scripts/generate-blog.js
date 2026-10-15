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
    const regex = new RegExp(
        `<meta\\s+[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`,
        "i"
    );

    const match = html.match(regex);

    return match ? decodeHtmlEntities(match[1]) : "";
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
            // Skip non-article pages located at the posts root.
            
if (
    (
        relativeDir === "" &&
        ["index.html", "privacy-policy.html"].includes(
            entry.name.toLowerCase()
        )
    ) ||
    relativePath.toLowerCase() === "page/2/index.html"
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

for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const html = fs.readFileSync(filePath, "utf8");

    const jsonLd = getJsonLd(html);

    const title =
        (jsonLd && jsonLd.headline) ||
        getTitle(html);

    const description =
        (jsonLd && jsonLd.description) ||
        getMetaContent(html, "description");

    const datePublished =
        jsonLd && jsonLd.datePublished
            ? jsonLd.datePublished
            : "";

    const dateModified =
        jsonLd && jsonLd.dateModified
            ? jsonLd.dateModified
            : datePublished;

    const category =
        jsonLd && jsonLd.articleSection
            ? jsonLd.articleSection
            : "General";

    const canonical =
        getCanonical(html) ||
        `${SITE_URL}/posts/${file.replace(/\.html$/i, "")}`;

    if (!title || !datePublished) {
        console.warn(`SKIPPED: ${file}`);
        console.warn("Reason: missing title or datePublished");
        continue;
    }

    posts.push({
        title: title.trim(),
        description: description.trim(),
        datePublished,
        dateModified,
        category,
        url: canonical
    });
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
console.log(`Output:          ${OUTPUT_FILE}`);
console.log("");

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
