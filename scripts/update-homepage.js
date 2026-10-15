
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const INDEX_FILE = path.join(ROOT, "index.html");

const START_MARKER = "<!-- AUTO-POSTS-START -->";
const END_MARKER = "<!-- AUTO-POSTS-END -->";
const MAX_POSTS = 6;
const SITE_ORIGIN = "https://blog.matrixqr.cc";

// Normalize URLs so /posts/example and
// https://blog.matrixqr.cc/posts/example/ match.
function normalizeUrl(value) {
    if (!value) return "";

    try {
        const parsed = new URL(
            String(value).replace(/&amp;/g, "&"),
            SITE_ORIGIN
        );

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
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
} catch (error) {
    console.error("ERROR: Unable to parse posts.json");
    console.error(error.message);
    process.exit(1);
}

if (!Array.isArray(posts)) {
    console.error("ERROR: posts.json must contain an array.");
    process.exit(1);
}

// Read homepage and locate the automatic insertion area.
const html = fs.readFileSync(INDEX_FILE, "utf8");
const startIndex = html.indexOf(START_MARKER);
const endIndex = html.indexOf(END_MARKER);

if (
    startIndex === -1 ||
    endIndex === -1 ||
    endIndex < startIndex
) {
    console.error("ERROR: Homepage markers are missing or misplaced.");
    process.exit(1);
}

// Exclude the generated area when checking existing links.
// This allows newly published posts to be detected on future builds.
const existingHtml =
    html.slice(0, startIndex) +
    html.slice(endIndex + END_MARKER.length);

// Collect links already present elsewhere on the homepage.
const existingUrls = new Set();
const hrefPattern = /\bhref\s*=\s*["']([^"']+)["']/gi;
let match;

while ((match = hrefPattern.exec(existingHtml)) !== null) {
    const url = normalizeUrl(match[1]);

    if (url) {
        existingUrls.add(url);
    }
}

// Only generate cards for posts not already linked on the homepage.
// Posts are expected to be sorted newest first by generate-blog.js.
const newPosts = posts
    .filter((post) => {
        return post.url && !existingUrls.has(normalizeUrl(post.url));
    })
    .slice(0, MAX_POSTS);

const generatedHtml = newPosts.map((post) => {
    const title = escapeHtml(post.title || "Untitled");
    const description = escapeHtml(post.description || "");
    const date = formatDate(post.datePublished || "");
    const datetime = escapeHtml(
        String(post.datePublished || "").slice(0, 10)
    );

    let relativeUrl;

    try {
        relativeUrl = new URL(post.url, SITE_ORIGIN).pathname;
    } catch {
        relativeUrl = post.url;
    }

    const url = escapeHtml(relativeUrl);

    return `
                <article class="bg-[#080d1a]/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-300 space-y-3 group hover:bg-[#0a1128]/80">
                    <div class="flex items-center gap-2 text-xs">
                        <span class="text-cyan-400 font-semibold uppercase tracking-wider bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                            Article
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
}).join("\n");

// Replace only the content between the markers.
const before = html.slice(0, startIndex + START_MARKER.length);
const after = html.slice(endIndex);

const updatedHtml =
    before +
    "\n" +
    generatedHtml +
    "\n            " +
    after;

fs.writeFileSync(INDEX_FILE, updatedHtml, "utf8");

console.log("");
console.log("======================================");
console.log(" MatrixQR Homepage Generator");
console.log("======================================");
console.log("");
console.log(`Posts available: ${posts.length}`);
console.log(`Existing homepage links: ${existingUrls.size}`);
console.log(`New cards displayed: ${newPosts.length}`);
console.log(`Updated: ${INDEX_FILE}`);
console.log("");
console.log("Homepage update completed.");
