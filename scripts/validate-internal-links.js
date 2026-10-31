"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getAttributes } = require("./html-link-utils");
const { findArticleHtmlFiles } = require("./article-source-files");

const ORIGIN = "https://blog.matrixqr.cc";
const GENERIC_ANCHORS = new Set([
    "click here", "here", "read more", "learn more", "more", "this article",
    "this page", "了解更多", "点击这里", "阅读更多"
]);

function decodeEntities(value = "") {
    return String(value)
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function walkHtmlFiles(root) {
    const files = [];
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(full);
        }
    }
    walk(root);
    return files.sort();
}

function normalizeLabel(root, file) {
    return path.relative(root, file).split(path.sep).join("/");
}

function resolveLocalTarget(root, pathname) {
    let decoded = pathname || "/";
    try { decoded = decodeURIComponent(decoded); } catch {}
    decoded = decoded.replace(/\/+/g, "/");
    if (/\.(css|js|mjs|json|xml|txt|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|map|pdf|zip)$/i.test(decoded)) return null;

    const clean = decoded.replace(/\/+$/, "") || "/";
    const candidates = clean === "/"
        ? [path.join(root, "index.html")]
        : path.extname(clean)
            ? [path.join(root, clean)]
            : [path.join(root, clean + ".html"), path.join(root, clean, "index.html")];

    const existing = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return existing || candidates[0];
}

function extractAnchors(html) {
    const anchors = [];
    for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
        const attrs = getAttributes("<a " + match[1] + ">");
        const text = decodeEntities(match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
        const imageAlt = [...match[2].matchAll(/<img\b[^>]*>/gi)]
            .map(item => getAttributes(item[0]).alt || "").filter(Boolean).join(" ").trim();
        anchors.push({
            href: String(attrs.href || "").trim(),
            text,
            accessibleName: text || attrs["aria-label"] || attrs.title || imageAlt,
            attrs
        });
    }
    return anchors;
}

function getArticleContent(html) {
    const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i);
    let content = articleMatch ? articleMatch[1] : html;
    content = content.replace(/<!--\s*SEO\/GEO Topic Cluster Links\s*-->[\s\S]*?<\/section\s*>/i, "");
    content = content.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    return content;
}

function getRelatedContent(html) {
    const marker = /<!--\s*SEO\/GEO Topic Cluster Links\s*-->/i;
    const match = html.match(marker);
    if (!match) return "";
    const start = match.index;
    const end = html.indexOf("</section>", start);
    return end === -1 ? html.slice(start) : html.slice(start, end + "</section>".length);
}

function normalizeInternalUrl(href, base) {
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return null;
    try {
        const url = new URL(decodeEntities(href), base);
        if (url.origin !== ORIGIN || url.pathname.startsWith("/dist/")) return null;
        return url;
    } catch {
        return null;
    }
}

function runAudit(root = path.resolve(__dirname, "..")) {
    const warnings = [];
    const htmlFiles = walkHtmlFiles(root);
    const articleRelativePaths = findArticleHtmlFiles(path.join(root, "posts"));
    const articleFiles = new Set(articleRelativePaths.map(rel => path.join(root, "posts", rel)));
    const articleUrlToFile = new Map();

    for (const file of articleFiles) {
        const rel = normalizeLabel(root, file);
        const route = "/" + rel.replace(/^posts\//i, "posts/").replace(/\.html$/i, "");
        articleUrlToFile.set(route.toLowerCase(), file);
        articleUrlToFile.set((route + "/").toLowerCase(), file);
    }

    const inboundSources = new Map();
    const repeatedTargets = [];
    const emptyAnchors = [];
    const genericAnchors = [];
    const brokenLinks = [];
    let internalLinkCount = 0;
    let bodyArticleLinks = 0;
    let relatedArticleLinks = 0;

    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, "utf8");
        const label = normalizeLabel(root, file);
        const base = ORIGIN + "/" + label;
        const allAnchors = extractAnchors(html);

        for (const anchor of allAnchors) {
            const url = normalizeInternalUrl(anchor.href, base);
            if (!url) continue;
            internalLinkCount++;
            const target = resolveLocalTarget(root, url.pathname);
            if (target && !fs.existsSync(target)) {
                brokenLinks.push(label + ': "' + anchor.href + '" has no local HTML target.');
            }
        }

        if (!articleFiles.has(file)) continue;

        const articleContent = getArticleContent(html);
        const relatedContent = getRelatedContent(html);
        const bodyAnchors = extractAnchors(articleContent);
        const relatedAnchors = extractAnchors(relatedContent);
        const seenTargets = new Map();

        const collectArticleLinks = (anchors, zone) => {
            for (const anchor of anchors) {
                const url = normalizeInternalUrl(anchor.href, base);
                if (!url) continue;
                const target = resolveLocalTarget(root, url.pathname);
                if (!target || !fs.existsSync(target) || !articleFiles.has(target)) continue;

                const targetLabel = normalizeLabel(root, target);
                if (target === file) continue;

                if (zone === "body") bodyArticleLinks++;
                else relatedArticleLinks++;

                if (!anchor.accessibleName) {
                    emptyAnchors.push(label + ': link to ' + targetLabel + " has no accessible anchor name.");
                } else if (GENERIC_ANCHORS.has(anchor.accessibleName.toLowerCase())) {
                    genericAnchors.push(label + ': generic anchor "' + anchor.accessibleName + '" points to ' + targetLabel + ".");
                }

                if (!seenTargets.has(targetLabel)) seenTargets.set(targetLabel, []);
                seenTargets.get(targetLabel).push({
                    zone,
                    accessibleName: String(anchor.accessibleName || "").trim().toLowerCase()
                });

                if (!inboundSources.has(targetLabel)) inboundSources.set(targetLabel, new Set());
                inboundSources.get(targetLabel).add(label);
            }
        };

        collectArticleLinks(bodyAnchors, "body");
        collectArticleLinks(relatedAnchors, "related");

        for (const [target, occurrences] of seenTargets) {
            // Different anchor labels or different page zones may serve distinct
            // editorial purposes. Warn only when the same accessible label points
            // to the same target more than once within the same zone.
            const groups = new Map();
            for (const occurrence of occurrences) {
                const key = occurrence.zone + "\\0" + occurrence.accessibleName;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(occurrence);
            }
            for (const [key, matches] of groups) {
                if (matches.length < 2) continue;
                const [zone, accessibleName] = key.split("\\0");
                const labelDescription = accessibleName
                    ? '"' + accessibleName + '"'
                    : "(empty accessible name)";
                repeatedTargets.push(
                    label + " repeats " + labelDescription + " to " + target +
                    " " + matches.length + " times in the " + zone + " zone."
                );
            }
        }

        const meaningfulCount = bodyAnchors.filter(anchor => {
            const url = normalizeInternalUrl(anchor.href, base);
            if (!url) return false;
            const target = resolveLocalTarget(root, url.pathname);
            return target && fs.existsSync(target) && articleFiles.has(target) && target !== file;
        }).length + relatedAnchors.filter(anchor => {
            const url = normalizeInternalUrl(anchor.href, base);
            if (!url) return false;
            const target = resolveLocalTarget(root, url.pathname);
            return target && fs.existsSync(target) && articleFiles.has(target) && target !== file;
        }).length;

        if (meaningfulCount === 0 && !/image-to-qr-menu-guide\.html$/i.test(label)) {
            warnings.push(label + ": no internal link to another article was found.");
        }
    }

    for (const file of articleFiles) {
        const label = normalizeLabel(root, file);
        const count = inboundSources.get(label)?.size || 0;
        if (count === 0 && !/image-to-qr-menu-guide\.html$/i.test(label)) {
            warnings.push(label + ": no independent article source links to this article.");
        }
    }

    warnings.push(...brokenLinks, ...emptyAnchors, ...genericAnchors, ...repeatedTargets);

    const report = {
        htmlPagesChecked: htmlFiles.length,
        articlePagesChecked: articleFiles.size,
        internalLinksChecked: internalLinkCount,
        bodyArticleLinks,
        relatedArticleLinks,
        articlesWithInboundSources: [...inboundSources.entries()].filter(([, sources]) => sources.size > 0).length,
        inboundSourceCounts: Object.fromEntries([...articleFiles].map(file => {
            const label = normalizeLabel(root, file);
            return [label, inboundSources.get(label)?.size || 0];
        }).sort(([a], [b]) => a.localeCompare(b))),
        findings: warnings
    };

    return report;
}

function main() {
    const report = runAudit();
    console.log("\\n======================================");
    console.log(" MatrixQR Internal Link Quality Audit");
    console.log("======================================");
    console.log("HTML pages checked: " + report.htmlPagesChecked);
    console.log("Article pages checked: " + report.articlePagesChecked);
    console.log("Internal links checked: " + report.internalLinksChecked);
    console.log("Article links in body: " + report.bodyArticleLinks);
    console.log("Article links in Related Guides: " + report.relatedArticleLinks);
    console.log("Articles with independent inbound sources: " + report.articlesWithInboundSources);
    console.log("Unique inbound source pages per article:");
    for (const [article, count] of Object.entries(report.inboundSourceCounts)) {
        console.log("  " + article + ": " + count);
    }
    if (report.findings.length) {
        console.warn("\\nFindings (" + report.findings.length + "):");
        report.findings.forEach(item => console.warn("- " + item));
    } else {
        console.log("\\nNo internal-link quality findings.");
    }
    console.log("\\nAudit completed. Findings are review warnings; this script never edits content.");
}

if (require.main === module) main();

module.exports = {
    GENERIC_ANCHORS,
    extractAnchors,
    getArticleContent,
    getRelatedContent,
    normalizeInternalUrl,
    resolveLocalTarget,
    runAudit
};
