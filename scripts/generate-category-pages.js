const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const TEMPLATE_FILE = path.join(ROOT, "templates", "archive-template.html.template");
const CATEGORY_ROOT = path.join(ROOT, "category");
const HTML_SITEMAP_FILE = path.join(ROOT, "sitemap", "index.html");
const SITE_URL = "https://blog.matrixqr.cc";
const { CATEGORY_NAMES } = require("./article-categories");

const CATEGORY_INFO = {
    "QR Code Security & Privacy": {
        slug: "qr-code-security-privacy",
        title: "QR Code Security & Privacy",
        description: "Explore QR code security, client-side generation, privacy protection, and practical guidance for safer QR workflows."
    },
    "Digital Menu & Branding": {
        slug: "digital-menu-branding",
        title: "Digital Menu & Branding",
        description: "Guides covering digital menu QR codes, custom QR branding, logos, scan reliability, and practical restaurant use cases."
    },
    "vCard & Contact Management": {
        slug: "vcard-contact-management",
        title: "vCard & Contact Management",
        description: "Learn about vCard QR codes, digital contact sharing, and practical contact-management workflows."
    },
    "General": {
        slug: "general",
        title: "General QR Code Guides",
        description: "Practical QR code tutorials, tool comparisons, product updates, and broadly useful implementation guidance."
    }
};

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function articleCard(post) {
    const href = new URL(post.url, SITE_URL).pathname;
    const date = String(post.datePublished || "").slice(0, 10);
    return `
        <article class="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-cyan-500/50">
            <time class="text-xs text-slate-500" datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>
            <h2 class="mt-3 text-lg font-semibold text-white transition-colors group-hover:text-cyan-300">
                <a href="${escapeHtml(href)}">${escapeHtml(post.title)}</a>
            </h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">${escapeHtml(post.description)}</p>
            <a href="${escapeHtml(href)}" class="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300">Read article <span aria-hidden="true">→</span></a>
        </article>`;
}

function replaceRequired(html, regex, replacement, label) {
    if (!regex.test(html)) throw new Error("Category template missing " + label);
    return html.replace(regex, replacement);
}

function buildPage(template, category, posts) {
    const info = CATEGORY_INFO[category];
    const canonical = `${SITE_URL}/category/${info.slug}/`;
    const title = `${info.title} | MatrixQR Blog`;
    const description = `${info.description} Browse ${posts.length} ${posts.length === 1 ? "article" : "articles"} from MatrixQR Blog.`;
    const cards = posts.map(articleCard).join("\n");
    let html = template;

    html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, "title");
    html = replaceRequired(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`, "description");
    html = replaceRequired(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`, "canonical");
    html = replaceRequired(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
    html = replaceRequired(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
    html = replaceRequired(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
    html = replaceRequired(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`, "twitter:title");
    html = replaceRequired(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`, "twitter:description");

    const schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": canonical + "#collection",
        name: info.title,
        url: canonical,
        description,
        isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "MatrixQR Blog" },
        publisher: { "@type": "Organization", "@id": "https://www.matrixqr.cc/#organization", name: "MatrixQR", url: "https://www.matrixqr.cc/" },
        mainEntity: { "@type": "ItemList", numberOfItems: posts.length, itemListElement: posts.map((post, index) => ({ "@type": "ListItem", position: index + 1, url: new URL(post.url, SITE_URL).href, name: post.title })) }
    };
    const schemaScript = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
    html = html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, schemaScript);

    html = replaceRequired(html, /<h1[\s\S]*?<\/h1>/i, `<h1 class="text-2xl md:text-3xl font-extrabold tracking-tight text-white">MatrixQR <span class="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">${escapeHtml(info.title)}</span></h1>`, "H1");
    html = replaceRequired(html, /<p class="text-slate-400 text-xs md:text-sm max-w-xl leading-relaxed">[\s\S]*?<\/p>/i, `<p class="text-slate-400 text-xs md:text-sm max-w-xl leading-relaxed">${escapeHtml(description)}</p>`, "intro");
    html = replaceRequired(html, /<!-- AUTO-ARCHIVE-START -->[\s\S]*?<!-- AUTO-ARCHIVE-END -->/i, `<!-- AUTO-ARCHIVE-START -->\n<section class="space-y-5"><div class="border-b border-slate-800 pb-3"><p class="text-sm text-slate-400">${posts.length} ${posts.length === 1 ? "article" : "articles"} in this topic.</p></div><div class="space-y-4">${cards}\n</div></section>\n<!-- AUTO-ARCHIVE-END -->`, "article marker");
    html = html.replace(/<!-- AUTO-ARCHIVE-PAGINATION-START -->[\s\S]*?<!-- AUTO-ARCHIVE-PAGINATION-END -->/i, "<!-- AUTO-ARCHIVE-PAGINATION-START --><!-- AUTO-ARCHIVE-PAGINATION-END -->");
    html = html.replace(/<body /i, '<body data-generated-page="category" ');
    html = html.replace(/<\/body>/i, "\n<!-- AUTO-GENERATED-CATEGORY-PAGE -->\n</body>");
    return html;
}

function patchHtmlSitemap(posts) {
    if (!fs.existsSync(HTML_SITEMAP_FILE)) return;
    let html = fs.readFileSync(HTML_SITEMAP_FILE, "utf8");
    const marker = "<!-- AUTO-SITEMAP-START -->";
    if (!html.includes(marker)) return;
    const active = CATEGORY_NAMES
        .filter(category => posts.some(post => post.category === category))
        .map(category => CATEGORY_INFO[category]);
    const nav = `\n<nav aria-label="Article categories" class="flex flex-wrap gap-2 mb-8">${active.map(info => `<a href="/category/${info.slug}/" class="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300">${escapeHtml(info.title)}</a>`).join(" ")}</nav>\n`;
    html = html.replace(marker, nav + marker);
    fs.writeFileSync(HTML_SITEMAP_FILE, html, "utf8");
}

function main() {
    if (!fs.existsSync(POSTS_FILE) || !fs.existsSync(TEMPLATE_FILE)) throw new Error("posts.json or archive template missing.");
    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
    if (!Array.isArray(posts)) throw new Error("posts.json must be an array.");
    const template = fs.readFileSync(TEMPLATE_FILE, "utf8");
    fs.mkdirSync(CATEGORY_ROOT, { recursive: true });
    const active = new Set();

    for (const category of CATEGORY_NAMES) {
        const info = CATEGORY_INFO[category];
        if (!info) throw new Error("Missing category metadata for canonical category: " + category);
        const categoryPosts = posts.filter(post => post.category === category).sort((a, b) => Date.parse(b.datePublished) - Date.parse(a.datePublished));
        if (!categoryPosts.length) continue;
        active.add(info.slug);
        const dir = path.join(CATEGORY_ROOT, info.slug);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), buildPage(template, category, categoryPosts), "utf8");
        console.log(`Generated category page: /category/${info.slug}/ (${categoryPosts.length} articles)`);
    }

    patchHtmlSitemap(posts);

    for (const entry of fs.readdirSync(CATEGORY_ROOT, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^[-a-z0-9]+$/.test(entry.name) || active.has(entry.name)) continue;
        const file = path.join(CATEGORY_ROOT, entry.name, "index.html");
        if (fs.existsSync(file) && fs.readFileSync(file, "utf8").includes("AUTO-GENERATED-CATEGORY-PAGE")) {
            fs.unlinkSync(file);
            try { fs.rmdirSync(path.join(CATEGORY_ROOT, entry.name)); } catch {}
            console.log("Removed obsolete generated category page: " + entry.name);
        }
    }
}

main();
