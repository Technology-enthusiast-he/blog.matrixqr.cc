const SITE_ORIGIN = "https://blog.matrixqr.cc";

function escapeHtml(value = "") {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getArticlePath(value) {
    try {
        const url = new URL(value, SITE_ORIGIN);
        return url.hostname.toLowerCase() === new URL(SITE_ORIGIN).hostname.toLowerCase() ? url.pathname : "";
    } catch { return ""; }
}

function getSafeImageUrl(value) {
    try {
        const url = new URL(value, SITE_ORIGIN);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
}

function createCard(post, index, duplicate = false) {
    const href = getArticlePath(post.url);
    const image = getSafeImageUrl(post.image);
    if (!href || !image) return "";
    const title = escapeHtml(post.title || "Read article");
    const alt = escapeHtml(duplicate ? "" : (post.imageAlt || post.title || "Article image"));
    const hidden = duplicate ? ' aria-hidden="true"' : "";
    const tabIndex = duplicate ? ' tabindex="-1"' : "";
    const loading = !duplicate && index === 0 ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
    const category = escapeHtml(post.category || "Article");
    return '<a href="' + escapeHtml(href) + '" class="w-72 h-40 rounded-xl overflow-hidden relative border border-slate-800 bg-slate-900 group block shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"' + tabIndex + hidden + ' aria-label="' + title + '">' +
        '<img src="' + escapeHtml(image) + '" alt="' + alt + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" width="288" height="160"' + loading + ' decoding="async">' +
        '<span class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent p-4 flex flex-col justify-end pointer-events-none">' +
        '<span class="text-[10px] text-cyan-400 font-mono uppercase">' + category + '</span>' +
        '<span class="text-xs font-bold text-white truncate">' + title + '</span></span></a>';
}

function renderArticleMarquee(posts = []) {
    const cards = posts.map((post, index) => createCard(post, index, false)).filter(Boolean);
    if (!cards.length) return '<p class="px-6 text-sm text-slate-400">Article images will appear here when available.</p>';
    const primary = cards.join("\n");
    const duplicate = posts.map((post, index) => createCard(post, index, true)).filter(Boolean).join("\n");
    return '<div class="animate-marquee gap-6 px-3"><div class="flex gap-6 shrink-0">' + primary +
        '</div><div class="flex gap-6 shrink-0" aria-hidden="true">' + duplicate + '</div></div>';
}

module.exports = { renderArticleMarquee };
