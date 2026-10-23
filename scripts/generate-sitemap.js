
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const SITEMAP_FILE = path.join(ROOT, "sitemap", "index.html");

const START_MARKER = "<!-- AUTO-SITEMAP-START -->";
const END_MARKER = "<!-- AUTO-SITEMAP-END -->";
const { CATEGORY_NAMES } = require("./article-categories");

const CATEGORY_PRESENTATION = {
    "QR Code Security & Privacy": {
        title: "Privacy & Security",
        icon: "shield-check",
        color: "cyan"
    },
    "Digital Menu & Branding": {
        title: "Digital Menu & Branding",
        icon: "utensils",
        color: "amber"
    },
    "vCard & Contact Management": {
        title: "vCard & Contact Management",
        icon: "contact",
        color: "violet"
    },
    "General": {
        title: "Tech & Guides",
        icon: "book-open",
        color: "emerald"
    }
};

const CATEGORIES = CATEGORY_NAMES.map((name) => {
    const presentation = CATEGORY_PRESENTATION[name];
    if (!presentation) {
        throw new Error("Missing sitemap presentation for canonical category: " + name);
    }
    return { name, ...presentation };
});

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);
}

function renderArticle(post, color) {
    const title = escapeHtml(post.title);
    const url = escapeHtml(post.url);
    const date = formatDate(post.datePublished);
    const safeDate = escapeHtml(date);

    return `
        <a href="${url}"
           class="group block bg-[#080d1a]/60 border border-slate-800/80 hover:border-${color}-500/40 rounded-xl p-4 transition-all duration-300 hover:bg-[#0a1128]/80">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h3 class="text-sm font-semibold text-slate-200 group-hover:text-${color}-400 transition-colors">
                        ${title}
                    </h3>
                    <p class="mt-2 text-xs text-slate-500">${safeDate}</p>
                </div>
                <i data-lucide="arrow-up-right"
                   class="w-4 h-4 shrink-0 text-slate-500 group-hover:text-${color}-400 transition-colors"></i>
            </div>
        </a>`;
}

function renderCategory(category, posts) {
    const categoryPosts = posts
        .filter((post) => post.category === category.name)
        .sort(
            (a, b) =>
                new Date(b.datePublished) -
                new Date(a.datePublished)
        );

    if (categoryPosts.length === 0) {
        return "";
    }

    const cards = categoryPosts
        .map((post) => renderArticle(post, category.color))
        .join("\n");

    return `
        <section class="space-y-5">
            <div class="flex items-center gap-3">
                <i data-lucide="${category.icon}"
                   class="w-5 h-5 text-${category.color}-400"></i>
                <h2 class="text-xl font-bold text-white">
                    ${escapeHtml(category.title)}
                </h2>
                <span class="text-xs text-slate-500">
                    ${categoryPosts.length} articles
                </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${cards}
            </div>
        </section>`;
}

function main() {
    if (!fs.existsSync(POSTS_FILE)) {
        throw new Error(
            "找不到 posts.json，请先运行现有的文章生成脚本。"
        );
    }

    if (!fs.existsSync(SITEMAP_FILE)) {
        throw new Error("找不到 sitemap/index.html。");
    }

    const posts = JSON.parse(
        fs.readFileSync(POSTS_FILE, "utf8")
    );

    const html = fs.readFileSync(SITEMAP_FILE, "utf8");

    if (
        !html.includes(START_MARKER) ||
        !html.includes(END_MARKER)
    ) {
        throw new Error(
            "找不到自动生成标记，请检查 sitemap/index.html。"
        );
    }

    const content = CATEGORIES
        .map((category) => renderCategory(category, posts))
        .filter(Boolean)
        .join("\n");

    const start = html.indexOf(START_MARKER);
    const end = html.indexOf(END_MARKER);

    if (end < start) {
        throw new Error("自动生成标记的顺序不正确。");
    }

    const startContent = start + START_MARKER.length;

    const updatedHtml =
        html.slice(0, startContent) +
        "\n" +
        content +
        "\n    " +
        html.slice(end);

    fs.writeFileSync(SITEMAP_FILE, updatedHtml, "utf8");

    console.log(
        `Sitemap 文章列表生成完成，共读取 ${posts.length} 篇文章。`
    );
}

main();
