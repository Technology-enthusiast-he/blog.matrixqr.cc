const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const INDEX_FILE = path.join(ROOT, "index.html");

const SECURITY_START = "<!-- AUTO-SECURITY-START -->";
const SECURITY_END = "<!-- AUTO-SECURITY-END -->";

const MENU_START = "<!-- AUTO-MENU-START -->";
const MENU_END = "<!-- AUTO-MENU-END -->";

const LATEST_START = "<!-- AUTO-POSTS-START -->";
const LATEST_END = "<!-- AUTO-POSTS-END -->";

const MAX_POSTS_PER_SECTION = 6;
const SITE_ORIGIN = "https://blog.matrixqr.cc";

// Normalize URLs so:
// /posts/example
// https://blog.matrixqr.cc/posts/example/
// are treated as the same URL.
function normalizeUrl(value) {
    if (!value) return "";

    try {
    const parsed = new URL(
            String(value).replace(/&amp;/g, "&"),
            SITE_ORIGIN
        );

        // Only URLs belonging to this blog can represent a manually listed
        // blog article. An external site may use the same pathname by chance.
        if (parsed.hostname.toLowerCase() !== new URL(SITE_ORIGIN).hostname.toLowerCase()) {
            return "";
        }

        let pathname = parsed.pathname;

        try {
            pathname = decodeURIComponent(pathname);
        } catch {
            // Keep the original pathname if decoding fails.
        }

        pathname = pathname.replace(/\/+$/, "") || "/";

        return pathname.toLowerCase();
    } catch {
        return String(value).trim().toLowerCase();
    }
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return String(dateString || "");
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
    }).format(date);
}

// Normalize category names for matching.
function normalizeCategory(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

// Category rules.
//
// Security / privacy related articles.

const SECURITY_CATEGORIES = [
    "qr code security & privacy"
];

const MENU_CATEGORIES = [
    "digital menu & branding"
];

function getCategory(post) {
    return normalizeCategory(post.category);
}

function isSecurityPost(post) {
    const category = getCategory(post);

    return SECURITY_CATEGORIES.includes(category);
}

function isMenuPost(post) {
    const category = getCategory(post);

    return MENU_CATEGORIES.includes(category);
}


function getPostUrl(post) {
    if (!post || !post.url) return "";

    try {
        return new URL(post.url, SITE_ORIGIN).pathname;
    } catch {
        return post.url;
    }
}

function createArticleCard(post, type = "Article") {
    const title = escapeHtml(post.title || "Untitled");
    const description = escapeHtml(post.description || "");
    const date = formatDate(post.datePublished || "");

    const datetime = escapeHtml(
        String(post.datePublished || "").slice(0, 10)
    );

    const url = escapeHtml(getPostUrl(post));

    let badgeClass =
        "text-cyan-400 font-semibold uppercase tracking-wider bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20";

    let hoverClass =
        "hover:border-cyan-500/40";

    if (type === "Security Tech") {
        badgeClass =
            "text-indigo-400 font-semibold uppercase tracking-wider bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20";

        hoverClass =
            "hover:border-indigo-500/40";
    }

    if (type === "Branding Guide") {
        badgeClass =
            "text-amber-400 font-semibold uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20";

        hoverClass =
            "hover:border-amber-500/40";
    }

    return `
                    <article class="bg-[#080d1a]/60 border border-slate-800/80 ${hoverClass} rounded-2xl p-6 transition-all duration-300 space-y-3 group hover:bg-[#0a1128]/80">
                        <div class="flex items-center gap-2 text-xs">
                            <span class="${badgeClass}">
                                ${escapeHtml(type)}
                            </span>
                            <span class="text-slate-400">•</span>
                            <time datetime="${datetime}" class="text-slate-400 font-mono">${date}</time>
                        </div>

                        <h3 class="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                            <a href="${url}">${title}</a>
                        </h3>

                        <p class="text-slate-400 text-sm leading-relaxed">
                            ${description}
                        </p>
                    </article>`;
}

function findMarkerRange(html, startMarker, endMarker) {
    const startIndex = html.indexOf(startMarker);
    const endIndex = html.indexOf(endMarker);

    if (
        startIndex === -1 ||
        endIndex === -1 ||
        endIndex < startIndex
    ) {
        return null;
    }

    return {
        startIndex,
        endIndex
    };
}

function replaceMarkerContent(html, startMarker, endMarker, content) {
    const range = findMarkerRange(
        html,
        startMarker,
        endMarker
    );

    if (!range) {
        throw new Error(
            `Missing or misplaced markers: ${startMarker} / ${endMarker}`
        );
    }

    const before =
        html.slice(0, range.startIndex + startMarker.length);

    const after =
        html.slice(range.endIndex);

    return (
        before +
        "\n" +
        content +
        "\n            " +
        after
    );
}

// Check required files.
for (const file of [POSTS_FILE, INDEX_FILE]) {
    if (!fs.existsSync(file)) {
        console.error("ERROR: Required file not found:", file);
        process.exit(1);
    }
}

// Read and validate posts.json.
let posts;

try {
    posts = JSON.parse(
        fs.readFileSync(POSTS_FILE, "utf8")
    );
} catch (error) {
    console.error("ERROR: Unable to parse posts.json");
    console.error(error.message);
    process.exit(1);
}

if (!Array.isArray(posts)) {
    console.error("ERROR: posts.json must contain an array.");
    process.exit(1);
}

// Read homepage.
let html = fs.readFileSync(INDEX_FILE, "utf8");

// Verify all three automatic areas exist.
for (const [startMarker, endMarker] of [
    [SECURITY_START, SECURITY_END],
    [MENU_START, MENU_END],
    [LATEST_START, LATEST_END]
]) {
    if (!findMarkerRange(html, startMarker, endMarker)) {
        console.error(
            "ERROR: Homepage markers are missing or misplaced:"
        );
        console.error(startMarker);
        console.error(endMarker);
        process.exit(1);
    }
}

// Remove ALL automatic areas temporarily when collecting
// manually existing homepage links.
//
// This is important because generated cards from a previous
// build must not be treated as manually curated cards.
let manualHomepageHtml = html;

for (const [startMarker, endMarker] of [
    [SECURITY_START, SECURITY_END],
    [MENU_START, MENU_END],
    [LATEST_START, LATEST_END]
]) {
    const range = findMarkerRange(
        manualHomepageHtml,
        startMarker,
        endMarker
    );

    const before =
        manualHomepageHtml.slice(0, range.startIndex);

    const after =
        manualHomepageHtml.slice(
            range.endIndex + endMarker.length
        );

    manualHomepageHtml =
        before + after;
}

// Collect manually existing homepage URLs.
const existingUrls = new Set();

const hrefPattern =
    /\bhref\s*=\s*["']([^"']+)["']/gi;

let match;

while (
    (match = hrefPattern.exec(manualHomepageHtml)) !== null
) {
    const url = normalizeUrl(match[1]);

    if (url) {
        existingUrls.add(url);
    }
}

// Remove posts that are already manually present on homepage.
const availablePosts = posts.filter((post) => {
    if (!post.url) return false;

    return !existingUrls.has(
        normalizeUrl(post.url)
    );
});

// Used URLs prevent the same automatically generated article
// from appearing in more than one automatic section.
const usedAutoUrls = new Set();

// Security posts.
const securityPosts = [];

for (const post of availablePosts) {
    if (!isSecurityPost(post)) continue;

    const url = normalizeUrl(post.url);

    if (!url || usedAutoUrls.has(url)) continue;

    securityPosts.push(post);
    usedAutoUrls.add(url);
}

// Digital Menu / Branding posts.
const menuPosts = [];

for (const post of availablePosts) {
    if (!isMenuPost(post)) continue;

    const url = normalizeUrl(post.url);

    if (!url || usedAutoUrls.has(url)) continue;

    menuPosts.push(post);
    usedAutoUrls.add(url);
}

// Limit the main category sections.
// Any overflow will be placed in Latest Articles.
const securityDisplayPosts =
    securityPosts.slice(0, MAX_POSTS_PER_SECTION);

const menuDisplayPosts =
    menuPosts.slice(0, MAX_POSTS_PER_SECTION);
// Only mark displayed category posts as used.
// Overflow posts can then appear in Latest Articles.
usedAutoUrls.clear();

for (const post of [
    ...securityDisplayPosts,
    ...menuDisplayPosts
]) {
    const url = normalizeUrl(post.url);

    if (url) {
        usedAutoUrls.add(url);
    }
}

// Put overflow from Security/Menu back into Latest Articles.
const overflowPosts = [
    ...securityPosts.slice(MAX_POSTS_PER_SECTION),
    ...menuPosts.slice(MAX_POSTS_PER_SECTION)
];

// Other posts become Latest Articles.
const latestPosts = [];

for (const post of availablePosts) {
    const url = normalizeUrl(post.url);

    if (!url) continue;

    if (usedAutoUrls.has(url)) {
        continue;
    }

    latestPosts.push(post);
    usedAutoUrls.add(url);
}

// Add overflow category posts to Latest Articles.
for (const post of overflowPosts) {
    const url = normalizeUrl(post.url);

    if (!url || usedAutoUrls.has(url)) {
        continue;
    }

    latestPosts.push(post);
    usedAutoUrls.add(url);
}

// Keep newest posts first.
// generate-blog.js normally already sorts posts,
// but sorting here makes this script safer.
function sortNewestFirst(a, b) {
    const dateA = new Date(a.datePublished || 0).getTime();
    const dateB = new Date(b.datePublished || 0).getTime();

    return dateB - dateA;
}

securityDisplayPosts.sort(sortNewestFirst);
menuDisplayPosts.sort(sortNewestFirst);
latestPosts.sort(sortNewestFirst);

// Generate Security cards.
const securityHtml = securityDisplayPosts
    .map((post) =>
        createArticleCard(post, "Security Tech")
    )
    .join("\n");

// Generate Digital Menu cards.
const menuHtml = menuDisplayPosts
    .map((post) =>
        createArticleCard(post, "Branding Guide")
    )
    .join("\n");

// Generate Latest Articles cards.
const latestHtml = latestPosts
    .slice(0, MAX_POSTS_PER_SECTION)
    .map((post) =>
        createArticleCard(post, "Article")
    )
    .join("\n");

// Replace only the contents inside each automatic area.
html = replaceMarkerContent(
    html,
    SECURITY_START,
    SECURITY_END,
    securityHtml
);

html = replaceMarkerContent(
    html,
    MENU_START,
    MENU_END,
    menuHtml
);

html = replaceMarkerContent(
    html,
    LATEST_START,
    LATEST_END,
    latestHtml
);

// Write updated homepage.
fs.writeFileSync(
    INDEX_FILE,
    html,
    "utf8"
);

// Console output for Vercel build logs.
console.log("");
console.log("======================================");
console.log(" MatrixQR Homepage Generator");
console.log("======================================");
console.log("");

console.log(`Posts available: ${posts.length}`);
console.log(`Existing manual homepage links: ${existingUrls.size}`);

console.log(
    `Security cards displayed: ${securityDisplayPosts.length}`
);

console.log(
    `Digital Menu cards displayed: ${menuDisplayPosts.length}`
);

console.log(
    `Latest Articles displayed: ${Math.min(
        latestPosts.length,
        MAX_POSTS_PER_SECTION
    )}`
);

console.log(`Updated: ${INDEX_FILE}`);
console.log("");

console.log("Homepage update completed.");
