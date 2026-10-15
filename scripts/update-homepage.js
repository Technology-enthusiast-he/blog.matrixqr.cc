const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const INDEX_FILE = path.join(ROOT, "index.html");

const START_MARKER = "<!-- AUTO-POSTS-START -->";
const END_MARKER = "<!-- AUTO-POSTS-END -->";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

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
        return dateString;
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
    }).format(date);
}

function getRelativeUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.pathname;
    } catch {
        return url;
    }
}

// --------------------------------------------------
// Check files
// --------------------------------------------------

if (!fs.existsSync(POSTS_FILE)) {
    console.error("ERROR: posts.json not found:");
    console.error(POSTS_FILE);
    process.exit(1);
}

if (!fs.existsSync(INDEX_FILE)) {
    console.error("ERROR: index.html not found:");
    console.error(INDEX_FILE);
    process.exit(1);
}

// --------------------------------------------------
// Read posts
// --------------------------------------------------

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

// --------------------------------------------------
// Generate homepage cards
// --------------------------------------------------

const recentPosts = posts.slice(0, 6);

const generatedHtml = recentPosts
    .map((post) => {
        const title = escapeHtml(post.title);
        const description = escapeHtml(post.description);
        const date = formatDate(post.datePublished);
        const datetime = escapeHtml(
            String(post.datePublished).slice(0, 10)
        );
        const url = escapeHtml(getRelativeUrl(post.url));

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
    })
    .join("\n");

// --------------------------------------------------
// Update index.html
// --------------------------------------------------

const html = fs.readFileSync(INDEX_FILE, "utf8");

const startIndex = html.indexOf(START_MARKER);
const endIndex = html.indexOf(END_MARKER);

if (startIndex === -1 || endIndex === -1) {
    console.error("ERROR: Homepage markers not found.");
    console.error("");
    console.error("Please add:");
    console.error(START_MARKER);
    console.error(END_MARKER);
    process.exit(1);
}

if (endIndex < startIndex) {
    console.error("ERROR: Homepage markers are in the wrong order.");
    process.exit(1);
}

const before = html.slice(
    0,
    startIndex + START_MARKER.length
);

const after = html.slice(endIndex);

const updatedHtml =
    before +
    "\n" +
    generatedHtml +
    "\n            " +
    after;

fs.writeFileSync(INDEX_FILE, updatedHtml, "utf8");

// --------------------------------------------------
// Report
// --------------------------------------------------

console.log("");
console.log("======================================");
console.log(" MatrixQR Homepage Generator");
console.log("======================================");
console.log("");
console.log(`Posts available: ${posts.length}`);
console.log(`Posts displayed: ${recentPosts.length}`);
console.log(`Updated:         ${INDEX_FILE}`);
console.log("");
console.log("Homepage update completed.");
