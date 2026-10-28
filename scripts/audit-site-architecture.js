const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://blog.matrixqr.cc";
const { getLinksByRel } = require("./html-link-utils");
const warnings = [];
const errors = [];
const htmlFiles = [];

function warn(message) { warnings.push(message); }
function fail(message) { errors.push(message); }
function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
    }
}
function decode(value) {
    return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function normalizeUrl(value) {
    try {
        const url = new URL(decode(value), ORIGIN);
        if (url.origin !== ORIGIN) return "";
        return url.origin + (url.pathname.replace(/\/+$/, "") || "/");
    } catch { return ""; }
}
function canonical(html) {
    const m = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    return m ? decode(m[1]) : "";
}
function meta(html, attr, key) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const tag = tags.find(t => {
        const m = t.match(new RegExp("\\b" + attr + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return m && m[2].toLowerCase() === key.toLowerCase();
    });
    const m = tag && tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
    return m ? decode(m[2]) : "";
}
function nodesFrom(html, label) {
    const nodes = [];
    const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of blocks) {
        try {
            const visit = value => {
                if (!value || typeof value !== "object") return;
                if (Array.isArray(value)) { value.forEach(visit); return; }
                nodes.push(value);
                if (Array.isArray(value["@graph"])) value["@graph"].forEach(visit);
            };
            visit(JSON.parse(block[1].trim()));
        } catch (e) { warn(label + ": invalid JSON-LD (" + e.message + ")."); }
    }
    return nodes;
}
function types(node) { return Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]; }
function resolveTarget(pathname) {
    let p = pathname || "/";
    try { p = decodeURIComponent(p); } catch {}
    p = p.replace(/\/+/g, "/");
    if (p === "/") return path.join(ROOT, "index.html");
    if (/\.(css|js|mjs|json|xml|txt|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|map|pdf|zip)$/i.test(p)) return null;
    p = p.replace(/\/+$/, "");
    const candidates = path.extname(p)
        ? [path.join(ROOT, p)]
        : [path.join(ROOT, p + ".html"), path.join(ROOT, p, "index.html")];
    return candidates.find(file => fs.existsSync(file)) || candidates[0];
}
function validateLinks() {
    const inbound = new Map();
    let count = 0;
    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, "utf8");
        const label = path.relative(ROOT, file).replace(/\\/g, "/");
        const hrefs = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)].map(m => decode(m[2].trim()));
        for (const href of hrefs) {
            if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) continue;
            let url;
            try { url = new URL(href, ORIGIN + "/" + label); } catch { continue; }
            if (url.origin !== ORIGIN || url.pathname.startsWith("/dist/")) continue;
            count++;
            const target = resolveTarget(url.pathname);
            if (!target) continue;
            if (!fs.existsSync(target)) {
                warn(label + ': internal link "' + href + '" has no local target (' + path.relative(ROOT, target).replace(/\\/g, "/") + ").");
            } else if (target.toLowerCase().endsWith(".html")) {
                const targetLabel = path.relative(ROOT, target).replace(/\\/g, "/");
                inbound.set(targetLabel, (inbound.get(targetLabel) || 0) + 1);
            }
        }
    }
    const articles = htmlFiles.filter(file => {
        if (!file.startsWith(path.join(ROOT, "posts") + path.sep)) return false;
        const rel = path.relative(path.join(ROOT, "posts"), file).replace(/\\/g, "/").toLowerCase();
        return rel !== "index.html" && rel !== "privacy-policy.html" && !/^page\/\d+\/index\.html$/.test(rel);
    });
    const low = articles.map(file => {
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        return { rel, count: inbound.get(rel) || 0 };
    }).filter(item => item.count < 2);
    if (low.length) warn("Articles with fewer than 2 inbound internal links: " + low.map(x => x.rel + " (" + x.count + ")").join("; "));
    console.log("Internal HTML links checked: " + count);
    console.log("Article pages checked for inbound links: " + articles.length);
}
function validateSchemas() {
    const websiteIds = new Set();
    let articlesChecked = 0;
    let collectionsChecked = 0;
    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, "utf8");
        const label = path.relative(ROOT, file).replace(/\\/g, "/");
        const canon = normalizeUrl(canonical(html));
        const nodes = nodesFrom(html, label);
        nodes.forEach(node => { if (types(node).includes("WebSite") && node["@id"]) websiteIds.add(node["@id"]); });
        const rel = path.relative(path.join(ROOT, "posts"), file).replace(/\\/g, "/").toLowerCase();
        // The user explicitly excluded this article from SEO/GEO changes; keep link auditing,
        // but do not enforce schema/breadcrumb normalization on this file.
        if (rel === "image-to-qr-menu-guide.html") continue;
        const isArticleFile = file.startsWith(path.join(ROOT, "posts") + path.sep) && rel !== "index.html" && rel !== "privacy-policy.html" && !/^page\/\d+\/index\.html$/.test(rel);
        if (isArticleFile) {
            const articles = nodes.filter(n => types(n).some(t => ["Article", "BlogPosting", "NewsArticle"].includes(t)));
            if (!articles.length) warn(label + ": no Article/BlogPosting node found.");
            for (const article of articles) {
                articlesChecked++;
                const page = typeof article.mainEntityOfPage === "string" ? article.mainEntityOfPage : article.mainEntityOfPage && (article.mainEntityOfPage["@id"] || article.mainEntityOfPage.url);
                if (canon && normalizeUrl(page) !== canon) fail(label + ": mainEntityOfPage does not match canonical.");
                if (!article.isPartOf) warn(label + ": Article schema has no isPartOf reference to WebSite or Blog collection.");
                if (article.publisher && !article.publisher["@id"]) warn(label + ": publisher Organization is embedded instead of referencing a stable @id.");
            }
            for (const crumb of nodes.filter(n => types(n).includes("BreadcrumbList"))) {
                const items = crumb.itemListElement || [];
                for (const breadcrumbItem of items) {
                    const breadcrumbUrl = typeof breadcrumbItem.item === "string"
                        ? breadcrumbItem.item
                        : breadcrumbItem.item && (breadcrumbItem.item["@id"] || breadcrumbItem.item.url);
                    if (normalizeUrl(breadcrumbUrl) === ORIGIN + "/posts" && breadcrumbItem.name !== "Posts") {
                        fail(label + ': BreadcrumbList item pointing to /posts/ must be named "Posts".');
                    }
                }
                if (items.length) {
                    const last = items[items.length - 1];
                    const item = typeof last.item === "string" ? last.item : last.item && (last.item["@id"] || last.item.url);
                    if (canon && normalizeUrl(item) !== canon) warn(label + ": final BreadcrumbList item does not match canonical.");

                    const navMatch = html.match(/<nav\b(?=[^>]*\baria-label=["']Breadcrumb["'])[^>]*>[\s\S]*?<\/nav>/i);
                    if (navMatch) {
                        const visibleItems = [];
                        for (const liMatch of navMatch[0].matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)) {
                            const li = liMatch[0];
                            const link = li.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
                            if (link) {
                                const href = normalizeUrl(link[1]);
                                const name = decode(link[2].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
                                if (href && name) visibleItems.push({ url: href, name });
                            } else if (/\baria-current=["']page["']/i.test(li)) {
                                const name = decode(li.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
                                if (canon && name) visibleItems.push({ url: canon, name });
                            }
                        }
                        const schemaItems = items.map(entry => {
                            const target = typeof entry.item === "string"
                                ? entry.item
                                : entry.item && (entry.item["@id"] || entry.item.url);
                            return { url: normalizeUrl(target), name: decode(entry.name || (entry.item && entry.item.name) || "").trim() };
                        });
                        if (visibleItems.length !== schemaItems.length) {
                            fail(label + ": visible breadcrumb item count does not match BreadcrumbList.");
                        } else {
                            for (let index = 0; index < schemaItems.length; index += 1) {
                                if (visibleItems[index].url !== schemaItems[index].url) {
                                    fail(label + ": visible breadcrumb URL/order does not match BreadcrumbList at item " + (index + 1) + ".");
                                }
                                if (visibleItems[index].name.toLowerCase() !== schemaItems[index].name.toLowerCase()) {
                                    fail(label + ': visible breadcrumb label "' + visibleItems[index].name + '" does not match BreadcrumbList name "' + schemaItems[index].name + '".');
                                }
                            }
                        }
                    } else {
                        fail(label + ": missing visible Breadcrumb navigation while BreadcrumbList schema exists.");
                    }
                }
            }
        }
        for (const collection of nodes.filter(n => types(n).includes("CollectionPage"))) {
            collectionsChecked++;
            if (canon && normalizeUrl(collection.url || collection["@id"]) !== canon) warn(label + ": CollectionPage URL does not match canonical.");
            if (!collection.isPartOf) warn(label + ": CollectionPage has no isPartOf reference to WebSite.");
        }
    }
    if (websiteIds.size > 1) warn("Multiple distinct WebSite @id values found: " + [...websiteIds].join(", "));
    if (!websiteIds.size) warn("No WebSite JSON-LD entity found.");
    console.log("Article schema nodes checked: " + articlesChecked);
    console.log("CollectionPage schema nodes checked: " + collectionsChecked);
    console.log("Distinct WebSite @id values: " + websiteIds.size);
}
function validateTaxonomy() {
    const roots = ["category", "categories", "tag", "tags"];
    const pages = [];
    for (const name of roots) {
        const root = path.join(ROOT, name);
        if (!fs.existsSync(root)) continue;
        const found = [];
        walk(root);
        for (const file of htmlFiles) if (file.startsWith(root + path.sep)) found.push(file);
        pages.push(...found);
    }
    const unique = [...new Set(pages)];
    if (!unique.length) {
        warn("No dedicated category/tag landing pages exist. Categories currently appear in homepage/archive sections; there are no independent taxonomy URLs to index.");
        return;
    }
    let sitemap = "";
    try { sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8"); } catch {}
    for (const file of unique) {
        const html = fs.readFileSync(file, "utf8");
        const label = path.relative(ROOT, file).replace(/\\/g, "/");
        const canon = canonical(html);
        const robots = meta(html, "name", "robots").toLowerCase();
        if (!canon) warn(label + ": taxonomy page has no canonical.");
        if (robots.includes("noindex")) warn(label + ": taxonomy page is marked noindex.");
        if (canon && !sitemap.includes("<loc>" + canon + "</loc>") && !sitemap.includes("<loc>" + canon.replace(/&/g, "&amp;") + "</loc>")) warn(label + ": taxonomy canonical is absent from sitemap.xml.");
    }
    console.log("Dedicated taxonomy pages checked: " + unique.length);
}
function main() {
    walk(ROOT);
    const unique = [...new Set(htmlFiles)];
    htmlFiles.length = 0;
    htmlFiles.push(...unique);
    console.log("\n======================================");
    console.log(" MatrixQR Site Architecture SEO/GEO Audit");
    console.log("======================================");
    validateLinks();
    validateSchemas();
    validateTaxonomy();
    if (warnings.length) {
        console.log("\nAudit findings (" + warnings.length + "):");
        warnings.forEach(item => console.warn("- " + item));
    } else console.log("\nNo architecture warnings found.");
    if (errors.length) {
        console.error("\nAudit errors (" + errors.length + "):");
        errors.forEach(item => console.error("- " + item));
        process.exit(1);
    }
    console.log("\nAudit completed. Findings are warnings for review; no taxonomy pages are created automatically.");
}
main();
