
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const POSTS_FILE = path.join(ROOT, "posts.json");

const SITE_URL = "https://blog.matrixqr.cc";
const { normalizeCategory, CATEGORIES: CATEGORY_MAP } = require("./article-categories");
const PAGE_SIZE = 6;

const ARCHIVE_START = "<!-- AUTO-ARCHIVE-START -->";
const ARCHIVE_END = "<!-- AUTO-ARCHIVE-END -->";
const PAGINATION_START = "<!-- AUTO-ARCHIVE-PAGINATION-START -->";
const PAGINATION_END = "<!-- AUTO-ARCHIVE-PAGINATION-END -->";

const CATEGORY_INFO = {
    "QR Code Security & Privacy": {
        title: "QR Code Security & Client-Side Privacy",
        label: "Security & Privacy",
        description: "Explore QR code security, privacy protection, and client-side generation."
    },
    "Digital Menu & Branding": {
        title: "Digital Menu & Custom Logo QR Solutions",
        label: "Digital Menu & Branding",
        description: "Guides for digital menus, custom QR codes, and branding."
    },
    "vCard & Contact Management": {
        title: "vCard & Contact Management Standards",
        label: "vCard & Contact Management",
        description: "Learn about contact QR codes and digital contact sharing."
    },
    "General": {
        title: "General QR Code Guides & Tool Comparisons",
        label: "Guide",
        description: "QR code tutorials, comparisons, and practical guides."
    }
};

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getCategory(post) {
    const raw = normalizeCategory(post.category || "General");
    return CATEGORY_MAP[raw] || "General";
}

function getPostPath(post) {
    const rawUrl = String(post.url || "");

    try {
        const parsed = new URL(rawUrl, SITE_URL);
        let pathname = parsed.pathname;

        if (!pathname.startsWith("/")) {
            pathname = "/" + pathname;
        }

        return pathname;
    } catch {
        return "/";
    }
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
}

function createCard(post) {
    const category = getCategory(post);
    const info = CATEGORY_INFO[category];
    const title = escapeHtml(post.title || "Untitled");
    const description = escapeHtml(post.description || "");
    const date = escapeHtml(formatDate(post.datePublished));
    const href = escapeHtml(getPostPath(post));

    return `
        <article class="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-cyan-500/50">
            <div class="mb-3 flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
                    ${escapeHtml(info.label)}
                </span>
                <time class="text-xs text-slate-500" datetime="${date}">${date}</time>
            </div>
            <h3 class="text-lg font-semibold text-white transition-colors group-hover:text-cyan-300">
                <a href="${href}">${title}</a>
            </h3>
            <p class="mt-2 text-sm leading-6 text-slate-400">${description}</p>
            <a href="${href}" class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300">
                Read article <span aria-hidden="true">→</span>
            </a>
        </article>
    `;
}

function createCategorySections(posts) {
    const grouped = new Map();

    for (const post of posts) {
        const category = getCategory(post);

        if (!grouped.has(category)) {
            grouped.set(category, []);
        }

        grouped.get(category).push(post);
    }

    const preferredOrder = [
        "QR Code Security & Privacy",
        "Digital Menu & Branding",
        "vCard & Contact Management",
        "General"
    ];

    return preferredOrder
        .filter(category => grouped.has(category))
        .map(category => {
            const info = CATEGORY_INFO[category];
            const cards = grouped.get(category).map(createCard).join("\n");

            return `
                <section class="space-y-5">
                    <div class="border-b border-slate-800 pb-3">
                        <h2 class="text-xl font-bold text-white">${escapeHtml(info.title)}</h2>
                        <p class="mt-2 text-sm text-slate-400">${escapeHtml(info.description)}</p>
                    </div>
                    <div class="space-y-4">
                        ${cards}
                    </div>
                </section>
            `;
        })
        .join("\n");
}

function createPagination(currentPage, totalPages) {
    if (totalPages <= 1) {
        return "";
    }

    const pageUrl = page => {
        return page === 1
            ? "/posts/"
            : `/posts/page/${page}/`;
    };

    let html = `
        <nav aria-label="Article archive pagination"
             class="flex flex-wrap items-center justify-center gap-2 mt-12 mb-10">
    `;

    if (currentPage > 1) {
        html += `
            <a href="${pageUrl(currentPage - 1)}"
               class="rounded-full border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800">
                ← Previous
            </a>
        `;
    }

    for (let page = 1; page <= totalPages; page++) {
        if (page === currentPage) {
            html += `
                <span aria-current="page"
                      class="rounded-full border border-cyan-500 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300">
                    ${page}
                </span>
            `;
        } else {
            html += `
                <a href="${pageUrl(page)}"
                   class="rounded-full border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800">
                    ${page}
                </a>
            `;
        }
    }

    if (currentPage < totalPages) {
        html += `
            <a href="${pageUrl(currentPage + 1)}"
               class="rounded-full border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800">
                Next →
            </a>
        `;
    }

    html += "</nav>";
    return html;
}

function replaceBetween(html, startMarker, endMarker, content) {
    const start = html.indexOf(startMarker);
    const end = html.indexOf(endMarker);

    if (start === -1 || end === -1 || end < start) {
        throw new Error(
            `Template marker missing or misplaced: ${startMarker} / ${endMarker}`
        );
    }

    return (
        html.slice(0, start + startMarker.length) +
        "\n" + content + "\n" +
        html.slice(end)
    );
}

function upsertMetaTag(html, attribute, key, value) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const existing = tags.find(tag => {
        const match = tag.match(new RegExp("\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return match && match[2].toLowerCase() === key.toLowerCase();
    });
    const replacement = '<meta ' + attribute + '="' + key + '" content="' + escapeHtml(value) + '">';
    if (existing) return html.replace(existing, replacement);
    return html.replace(/<\/head>/i, "    " + replacement + "\n</head>");
}

function syncCollectionPageDescription(html, description) {
    return html.replace(
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

                const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
                if (types.includes("CollectionPage") && node.description !== description) {
                    node.description = description;
                    changed = true;
                }

                if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
            };

            visit(value);
            return changed
                ? full.replace(jsonText, "\n" + JSON.stringify(value, null, 2) + "\n")
                : full;
        }
    );
}

function updateSeo(html, page, totalPages) {
    const canonicalPath = page === 1
        ? "/posts/"
        : `/posts/page/${page}/`;

    const title = page === 1
        ? "Article Archive | MatrixQR Blog"
        : `Article Archive - Page ${page} | MatrixQR Blog`;

    const description = page === 1
        ? "Browse MatrixQR Blog articles about QR code security, digital menus, privacy, and QR code tools."
        : `Browse page ${page} of MatrixQR Blog's article archive, including QR code security, privacy, digital menus, and practical guides.`;

    html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>`
    );

    const descriptionTag =
        `<meta name="description" content="${escapeHtml(description)}">`;

    if (/<meta\s+[^>]*name=["']description["'][^>]*>/i.test(html)) {
        html = html.replace(
            /<meta\s+[^>]*name=["']description["'][^>]*>/i,
            descriptionTag
        );
    } else {
        html = html.replace(/<\/head>/i, `    ${descriptionTag}\n</head>`);
    }

    const canonicalTag =
        `<link rel="canonical" href="${SITE_URL}${canonicalPath}">`;

    if (/<link\s+[^>]*rel=["']canonical["'][^>]*>/i.test(html)) {
        html = html.replace(
            /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
            canonicalTag
        );
    } else {
        html = html.replace(/<\/head>/i, `    ${canonicalTag}\n</head>`);
    }

    html = html.replace(
        /\s*<link\s+[^>]*rel=["']prev["'][^>]*>/gi,
        ""
    );
    html = html.replace(
        /\s*<link\s+[^>]*rel=["']next["'][^>]*>/gi,
        ""
    );

    let extraLinks = "";

    if (page > 1) {
        const previous = page === 2
            ? "/posts/"
            : `/posts/page/${page - 1}/`;

        extraLinks += `<link rel="prev" href="${SITE_URL}${previous}">\n`;
    }

    if (page < totalPages) {
        extraLinks += `<link rel="next" href="${SITE_URL}/posts/page/${page + 1}/">\n`;
    }

    if (extraLinks) {
        html = html.replace(/<\/head>/i, `    ${extraLinks}</head>`);
    }

    html = upsertMetaTag(html, "property", "og:url", SITE_URL + canonicalPath);
    html = upsertMetaTag(html, "property", "og:title", title);
    html = upsertMetaTag(html, "property", "og:description", description);
    html = upsertMetaTag(html, "name", "twitter:title", title);
    html = upsertMetaTag(html, "name", "twitter:description", description);
    // Keep CollectionPage structured data aligned with the same generated archive description.
    html = syncCollectionPageDescription(html, description);

    return html;
}

function main() {
    if (!fs.existsSync(POSTS_FILE)) {
        throw new Error("posts.json not found. Run generate-blog.js first.");
    }

    const templatePath = path.join(ROOT, "templates", "archive-template.html.template");

    if (!fs.existsSync(templatePath)) {
        throw new Error("Archive template not found: templates/archive-template.html.template");
    }

    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));

    posts.sort(
        (a, b) => new Date(b.datePublished) - new Date(a.datePublished)
    );

    const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
    const template = fs.readFileSync(templatePath, "utf8");

    // Validate markers before writing any pages.
    for (const marker of [
        ARCHIVE_START,
        ARCHIVE_END,
        PAGINATION_START,
        PAGINATION_END
    ]) {
        if (!template.includes(marker)) {
            throw new Error(
                `Add this marker to posts/index.html before building: ${marker}`
            );
        }
    }

    for (let page = 1; page <= totalPages; page++) {
        const pagePosts = posts.slice(
            (page - 1) * PAGE_SIZE,
            page * PAGE_SIZE
        );

        let html = template;

        html = replaceBetween(
            html,
            ARCHIVE_START,
            ARCHIVE_END,
            createCategorySections(pagePosts)
        );

        html = replaceBetween(
            html,
            PAGINATION_START,
            PAGINATION_END,
            createPagination(page, totalPages)
        );

        html = updateSeo(html, page, totalPages);

        // Mark generated archive pages for safe cleanup later.
        html = html.replace(
            /<\/body>/i,
            "\n<!-- AUTO-GENERATED-ARCHIVE-PAGE -->\n</body>"
        );

        const outputDir = page === 1
            ? POSTS_DIR
            : path.join(POSTS_DIR, "page", String(page));

        fs.mkdirSync(outputDir, { recursive: true });

        const outputFile = path.join(outputDir, "index.html");
        fs.writeFileSync(outputFile, html, "utf8");

        console.log(`Generated archive page ${page}: ${outputFile}`);
    }

    // Remove only obsolete numeric archive pages.
    const pageRoot = path.join(POSTS_DIR, "page");

    if (fs.existsSync(pageRoot)) {
        for (const entry of fs.readdirSync(pageRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) {
                continue;
            }

            const pageNumber = Number(entry.name);

            if (pageNumber <= totalPages) {
                continue;
            }

            const obsoleteFile = path.join(pageRoot, entry.name, "index.html");

            if (
                fs.existsSync(obsoleteFile) &&
                fs.readFileSync(obsoleteFile, "utf8")
                    .includes("AUTO-GENERATED-ARCHIVE-PAGE")
            ) {
                fs.rmSync(path.join(pageRoot, entry.name), {
                    recursive: true,
                    force: true
                });

                console.log(`Removed obsolete archive page ${pageNumber}`);
            }
        }
    }

    console.log(`Archive generation complete. Articles: ${posts.length}`);
    console.log(`Articles per page: ${PAGE_SIZE}`);
    console.log(`Total archive pages: ${totalPages}`);
}

main();
