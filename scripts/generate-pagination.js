
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const INDEX_FILE = path.join(ROOT, "index.html");
const PAGE_DIR = path.join(ROOT, "page");

const SITE_ORIGIN = "https://blog.matrixqr.cc";
const PAGE_SIZE = 6;

const LATEST_START = "<!-- AUTO-POSTS-START -->";
const LATEST_END = "<!-- AUTO-POSTS-END -->";

const SECTION_1 = "<!-- Section 1: Featured & Recommendation -->";
const SECTION_4 = "<!-- Section 4: Latest Articles -->";

const GENERATED_MARKER = "<!-- AUTO-GENERATED-PAGINATION-PAGE -->";

function normalizeUrl(value) {
    if (!value) return "";

    try {
        const url = new URL(
            String(value).replace(/&amp;/g, "&"),
            SITE_ORIGIN
        );

        // Only same-site URLs can suppress an indexed article from homepage pagination.
        // External links may coincidentally use the same pathname.
        if (url.hostname.toLowerCase() !== new URL(SITE_ORIGIN).hostname.toLowerCase()) {
            return "";
        }

        let pathname = url.pathname;

        try {
            pathname = decodeURIComponent(pathname);
        } catch {}

        return pathname.replace(/\/+$/, "").toLowerCase() || "/";
    } catch {
        return String(value).trim().toLowerCase();
    }
}

function getPostUrl(post) {
    try {
        return new URL(post.url, SITE_ORIGIN).pathname;
    } catch {
        return post.url || "";
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

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value || "");
    }

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
    }).format(date);
}

function createArticleCard(post) {
    const title = escapeHtml(post.title || "Untitled");
    const description = escapeHtml(post.description || "");
    const url = escapeHtml(getPostUrl(post));
    const dateValue = String(post.datePublished || "");
    const datetime = escapeHtml(dateValue.slice(0, 10));
    const date = formatDate(dateValue);

    return `
<article class="bg-[#080d1a]/60 border border-slate-800/80 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-300 space-y-3 group hover:bg-[#0a1128]/80">
    <div class="flex items-center gap-2 text-xs">
        <span class="text-cyan-400 font-semibold uppercase tracking-wider bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">Article</span>
        <span class="text-slate-400">•</span>
        <time datetime="${datetime}" class="text-slate-400 font-mono">${date}</time>
    </div>
    <h3 class="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
        <a href="${url}">${title}</a>
    </h3>
    <p class="text-slate-400 text-sm leading-relaxed">${description}</p>
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

    return { startIndex, endIndex };
}

function replaceLatestArticles(html, posts) {
    const range = findMarkerRange(
        html,
        LATEST_START,
        LATEST_END
    );

    if (!range) {
        throw new Error("Latest Articles markers are missing.");
    }

    const cards = posts.map(createArticleCard).join("\n");

    return (
        html.slice(0, range.startIndex + LATEST_START.length) +
        "\n" +
        cards +
        "\n" +
        html.slice(range.endIndex)
    );
}

function createPagination(pageNumber, totalPages) {
    const buttonClass =
        "border rounded-full px-6 py-2 text-white hover:bg-zinc-200 hover:text-zinc-900 transition-colors duration-200";

    const links = [];

    if (pageNumber > 1) {
        const previousUrl =
            pageNumber === 2 ? "/" : `/page/${pageNumber - 1}/`;

        links.push(
            `<a class="${buttonClass}" href="${previousUrl}">← Previous</a>`
        );
    }

    if (pageNumber < totalPages) {
        links.push(
            `<a class="${buttonClass}" href="/page/${pageNumber + 1}/">Next →</a>`
        );
    }

    if (!links.length) return "";

    return `
<div class="flex justify-center mt-12 mb-10 gap-3 flex-wrap">
    ${links.join("\n    ")}
</div>`;
}

function replacePagination(html, pageNumber, totalPages) {
    const pattern =
        /<div class="flex justify-center mt-12 mb-10(?:\s+gap-3 flex-wrap)?">[\s\S]*?<\/div>/i;

    if (!pattern.test(html)) {
        throw new Error("Pagination container was not found.");
    }

    return html.replace(
        pattern,
        createPagination(pageNumber, totalPages)
    );
}

function getMetaContent(html, attribute, key) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const tag = tags.find(item => {
        const attr = item.match(new RegExp("\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return attr && attr[2].toLowerCase() === key.toLowerCase();
    });
    if (!tag) return "";
    const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
    return content ? content[2] : "";
}

function upsertMeta(html, attribute, key, content) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const existing = tags.find(item => {
        const attr = item.match(new RegExp("\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return attr && attr[2].toLowerCase() === key.toLowerCase();
    });
    const replacement = '<meta ' + attribute + '="' + key + '" content="' + escapeHtml(content) + '" />';
    if (existing) return html.replace(existing, replacement);
    return html.replace(/<\/head>/i, "    " + replacement + "\n</head>");
}

function setPageMeta(html, pageNumber, totalPages) {
    const pageUrl = pageNumber === 1
        ? SITE_ORIGIN + "/"
        : SITE_ORIGIN + "/page/" + pageNumber + "/";
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const title = pageNumber === 1
        ? ((titleMatch || [])[1] || "MatrixQR Blog")
        : "Latest QR Code Articles - Page " + pageNumber + " | MatrixQR Blog";
    const plainTitle = title.replace(/<[^>]*>/g, "").trim();
    const baseDescription = getMetaContent(html, "name", "description");
    const description = pageNumber === 1
        ? baseDescription
        : "Browse page " + pageNumber + " of MatrixQR Blog's latest QR code security, privacy, digital menu, and contact QR guides.";

    const canonicalPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
    if (canonicalPattern.test(html)) {
        html = html.replace(canonicalPattern, '<link rel="canonical" href="' + pageUrl + '">');
    } else {
        html = html.replace(/<\/head>/i, '    <link rel="canonical" href="' + pageUrl + '">\n</head>');
    }

    html = upsertMeta(html, "property", "og:url", pageUrl);
    html = upsertMeta(html, "property", "og:title", plainTitle);
    html = upsertMeta(html, "property", "og:description", description);
    html = upsertMeta(html, "name", "twitter:title", plainTitle);
    html = upsertMeta(html, "name", "twitter:description", description);
    if (description) html = upsertMeta(html, "name", "description", description);

    if (pageNumber > 1) {
        html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(plainTitle) + "</title>");
        if (!html.includes(GENERATED_MARKER)) {
            html = html.replace(/<\/head>/i, GENERATED_MARKER + "\n</head>");
        }
    }

    html = html.replace(/\s*<link\b(?=[^>]*\brel=["'](?:prev|next)["'])[^>]*>/gi, "");
    let paginationLinks = "";
    if (pageNumber > 1) {
        const previous = pageNumber === 2 ? "/" : "/page/" + (pageNumber - 1) + "/";
        paginationLinks += '<link rel="prev" href="' + SITE_ORIGIN + previous + '">\n';
    }
    if (pageNumber < totalPages) {
        paginationLinks += '<link rel="next" href="' + SITE_ORIGIN + "/page/" + (pageNumber + 1) + '/">\n';
    }
    if (paginationLinks) html = html.replace(/<\/head>/i, "    " + paginationLinks + "</head>");

    return html;
}
function sortNewestFirst(a, b) {
    const dateA = new Date(a.datePublished || 0).getTime();
    const dateB = new Date(b.datePublished || 0).getTime();

    return (
        (Number.isFinite(dateB) ? dateB : 0) -
        (Number.isFinite(dateA) ? dateA : 0)
    );
}

function main() {
    if (
        !fs.existsSync(POSTS_FILE) ||
        !fs.existsSync(INDEX_FILE)
    ) {
        throw new Error("posts.json or index.html was not found.");
    }

    const posts = JSON.parse(
        fs.readFileSync(POSTS_FILE, "utf8")
    );

    if (!Array.isArray(posts)) {
        throw new Error("posts.json must contain an array.");
    }

    const homepage = fs.readFileSync(INDEX_FILE, "utf8");

    const sectionStart = homepage.indexOf(SECTION_1);
    const sectionEnd = homepage.indexOf(SECTION_4);

    if (
        sectionStart === -1 ||
        sectionEnd === -1 ||
        sectionEnd < sectionStart
    ) {
        throw new Error(
            "Could not find the homepage featured/category sections."
        );
    }

    
const featuredAndCategories = homepage.slice(
    sectionStart,
    sectionEnd
);

const excludedUrls = new Set();

// Normalize every link in the featured/category area and keep only same-site
// paths. A regex against raw href text would also match third-party URLs that
// happen to contain a local article pathname.
const featuredArticleUrls = new Set(
    [...featuredAndCategories.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)]
        .map((match) => normalizeUrl(match[2]))
        .filter(Boolean)
);

for (const post of posts) {
    if (!post.url) continue;

    const postUrl = normalizeUrl(post.url);
    if (postUrl && featuredArticleUrls.has(postUrl)) {
        excludedUrls.add(postUrl);
    }
}


    const uniquePosts = new Map();

    for (const post of posts) {
        if (!post.url) continue;

        const key = normalizeUrl(post.url);

        if (!key || excludedUrls.has(key)) continue;

        if (!uniquePosts.has(key)) {
            uniquePosts.set(key, post);
        }
    }

    const latestPosts = [...uniquePosts.values()]
        .sort(sortNewestFirst);

    const totalPages = Math.max(
        1,
        Math.ceil(latestPosts.length / PAGE_SIZE)
    );

    let updatedHomepage = replaceLatestArticles(
        homepage,
        latestPosts.slice(0, PAGE_SIZE)
    );

    updatedHomepage = replacePagination(
        updatedHomepage,
        1,
        totalPages
    );

    updatedHomepage = setPageMeta(updatedHomepage, 1, totalPages);
    fs.writeFileSync(INDEX_FILE, updatedHomepage, "utf8");

    // Every pagination page uses the full homepage template.
    // Only Latest Articles, page metadata and navigation change.
    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
        const start = (pageNumber - 1) * PAGE_SIZE;
        const pagePosts = latestPosts.slice(start, start + PAGE_SIZE);

        let pageHtml = replaceLatestArticles(homepage, pagePosts);

        pageHtml = setPageMeta(pageHtml, pageNumber, totalPages);

        pageHtml = replacePagination(
            pageHtml,
            pageNumber,
            totalPages
        );

        const outputDir = path.join(PAGE_DIR, String(pageNumber));
        const outputFile = path.join(outputDir, "index.html");

        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputFile, pageHtml, "utf8");

        console.log(
            `Page ${pageNumber}: ${pagePosts.length} articles`
        );
    }

    // Remove only obsolete pages previously generated by this script.
    if (fs.existsSync(PAGE_DIR)) {
        for (const entry of fs.readdirSync(PAGE_DIR, {
            withFileTypes: true
        })) {
            if (
                !entry.isDirectory() ||
                !/^\d+$/.test(entry.name)
            ) {
                continue;
            }

            const pageNumber = Number(entry.name);

            if (pageNumber <= totalPages || pageNumber < 2) {
                continue;
            }

            const outputFile = path.join(
                PAGE_DIR,
                entry.name,
                "index.html"
            );

            if (!fs.existsSync(outputFile)) continue;

            const oldHtml = fs.readFileSync(outputFile, "utf8");

            if (oldHtml.includes(GENERATED_MARKER)) {
                fs.rmSync(outputFile);

                const pagePath = path.join(PAGE_DIR, entry.name);

                if (fs.readdirSync(pagePath).length === 0) {
                    fs.rmdirSync(pagePath);
                }

                console.log(
                    `Removed obsolete generated page ${pageNumber}.`
                );
            }
        }
    }

    console.log("");
    console.log("Pagination generation completed.");
    console.log(`Queue size: ${latestPosts.length}`);
    console.log(`Articles per page: ${PAGE_SIZE}`);
    console.log(`Total pages: ${totalPages}`);
}

try {
    main();
} catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
}
