const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://blog.matrixqr.cc";
const failures = [];

function fail(message) { failures.push(message); }

function walkNumberedPages(parent, urlPrefix) {
    if (!fs.existsSync(parent)) return [];
    return fs.readdirSync(parent, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => Number(entry.name))
        .filter(page => page >= 2 && fs.existsSync(path.join(parent, String(page), "index.html")))
        .sort((a, b) => a - b)
        .map(page => ({ page, file: path.join(parent, String(page), "index.html"), url: urlPrefix + page + "/" }));
}

function decodeEntities(value = "") {
    return String(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function getTag(html, tagName, predicate) {
    const tags = html.match(new RegExp("<" + tagName + "\\b[^>]*>", "gi")) || [];
    return tags.find(tag => predicate(tag)) || "";
}

function getAttr(tag, name) {
    const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"));
    return match ? decodeEntities(match[2].trim()) : "";
}

function getMeta(html, attribute, key) {
    const tag = getTag(html, "meta", tag => getAttr(tag, attribute).toLowerCase() === key.toLowerCase());
    return getAttr(tag, "content");
}

function getLink(html, rel) {
    const tag = getTag(html, "link", tag => getAttr(tag, "rel").toLowerCase().split(/\s+/).includes(rel.toLowerCase()));
    return getAttr(tag, "href");
}

function normalizeAbsoluteUrl(value) {
    try {
        const url = new URL(value, ORIGIN);
        if (url.origin !== ORIGIN) return "";
        return url.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    } catch { return ""; }
}

function checkPage(file, expectedPath, label, options = {}) {
    if (!fs.existsSync(file)) {
        fail(label + ": file missing: " + path.relative(ROOT, file));
        return null;
    }
    const html = fs.readFileSync(file, "utf8");
    const expectedUrl = ORIGIN + (expectedPath === "/" ? "/" : expectedPath);
    const canonical = getLink(html, "canonical");
    const ogUrl = getMeta(html, "property", "og:url");
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]*>/g, "").trim()) : "";
    const description = getMeta(html, "name", "description");
    const ogTitle = getMeta(html, "property", "og:title");
    const ogDescription = getMeta(html, "property", "og:description");
    const twitterTitle = getMeta(html, "name", "twitter:title");
    const twitterDescription = getMeta(html, "name", "twitter:description");

    if (!canonical) fail(label + ": missing canonical link.");
    else if (normalizeAbsoluteUrl(canonical) !== normalizeAbsoluteUrl(expectedUrl) || !canonical.startsWith(ORIGIN)) {
        fail(label + ": canonical should be " + expectedUrl + " but is " + canonical);
    }
    if (!ogUrl) fail(label + ": missing og:url.");
    else if (normalizeAbsoluteUrl(ogUrl) !== normalizeAbsoluteUrl(expectedUrl) || !ogUrl.startsWith(ORIGIN)) {
        fail(label + ": og:url should be " + expectedUrl + " but is " + ogUrl);
    }
    if (!title) fail(label + ": missing title.");
    if (!description) fail(label + ": missing meta description.");
    if (!ogTitle) fail(label + ": missing og:title.");
    if (!ogDescription) fail(label + ": missing og:description.");
    if (!twitterTitle) fail(label + ": missing twitter:title.");
    if (!twitterDescription) fail(label + ": missing twitter:description.");
    if (options.expectedTitle && title !== options.expectedTitle) {
        fail(label + ': title should be "' + options.expectedTitle + '" but is "' + title + '".');
    }
    if (options.previous !== undefined) {
        const actual = getLink(html, "prev");
        const expected = options.previous ? ORIGIN + options.previous : "";
        if (actual !== expected) fail(label + ': rel=prev should be "' + expected + '" but is "' + actual + '".');
    }
    if (options.next !== undefined) {
        const actual = getLink(html, "next");
        const expected = options.next ? ORIGIN + options.next : "";
        if (actual !== expected) fail(label + ': rel=next should be "' + expected + '" but is "' + actual + '".');
    }

    const paginationHrefs = [...html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)]
        .map(match => decodeEntities(match[2]))
        .map(href => { try { return new URL(href, ORIGIN).pathname; } catch { return ""; } })
        .filter(url => /^\/(?:page\/\d+|posts\/page\/\d+)\/?$/.test(url));
    for (const targetPath of paginationHrefs) {
        const targetFile = path.join(ROOT, targetPath.replace(/\/+$/, ""), "index.html");
        if (!fs.existsSync(targetFile)) fail(label + ": pagination link points to missing page " + targetPath);
    }
    return { html, title, description };
}

function checkSequence(pages, label) {
    const actual = pages.map(item => item.page);
    const expected = Array.from({ length: actual.length }, (_, index) => index + 2);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        fail(label + ": numbered pages are not contiguous from page 2. Found: " + actual.join(", "));
    }
}

function main() {
    const homePages = walkNumberedPages(path.join(ROOT, "page"), "/page/");
    const archivePages = walkNumberedPages(path.join(ROOT, "posts", "page"), "/posts/page/");
    checkSequence(homePages, "Homepage pagination");
    checkSequence(archivePages, "Article archive pagination");

    const homePageCount = homePages.length + 1;
    const homeRecords = [{ page: 1, file: path.join(ROOT, "index.html"), url: "/" }, ...homePages];
    homeRecords.forEach(item => {
        const previous = item.page > 1 ? (item.page === 2 ? "/" : "/page/" + (item.page - 1) + "/") : "";
        const next = item.page < homePageCount ? "/page/" + (item.page + 1) + "/" : "";
        const expectedTitle = item.page === 1 ? undefined : "Latest QR Code Articles - Page " + item.page + " | MatrixQR Blog";
        const checked = checkPage(item.file, item.url, "Homepage pagination page " + item.page, {
            expectedTitle, previous, next
        });
        if (item.page > 1 && checked && !checked.html.includes("<!-- AUTO-GENERATED-PAGINATION-PAGE -->")) {
            fail("Homepage pagination page " + item.page + ": missing generated-page marker.");
        }
    });

    const archivePageCount = archivePages.length + 1;
    const archiveRecords = [{ page: 1, file: path.join(ROOT, "posts", "index.html"), url: "/posts/" }, ...archivePages];
    archiveRecords.forEach(item => {
        const previous = item.page > 1 ? (item.page === 2 ? "/posts/" : "/posts/page/" + (item.page - 1) + "/") : "";
        const next = item.page < archivePageCount ? "/posts/page/" + (item.page + 1) + "/" : "";
        const expectedTitle = item.page === 1 ? "Article Archive | MatrixQR Blog" : "Article Archive - Page " + item.page + " | MatrixQR Blog";
        const checked = checkPage(item.file, item.url, "Article archive page " + item.page, {
            expectedTitle, previous, next
        });
        if (checked && !checked.html.includes("<!-- AUTO-GENERATED-ARCHIVE-PAGE -->")) {
            fail("Article archive page " + item.page + ": missing generated-page marker.");
        }
    });

    console.log("");
    console.log("======================================");
    console.log(" MatrixQR Pagination & SEO Validation");
    console.log("======================================");
    console.log("Homepage pagination pages: " + homePageCount);
    console.log("Article archive pages: " + archivePageCount);
    if (failures.length) {
        console.error("Found " + failures.length + " issue(s):");
        failures.forEach(message => console.error("- " + message));
        process.exit(1);
    }
    console.log("PASS: pagination links, canonical URLs, titles, descriptions, OG/Twitter metadata, and archive rel links are consistent.");
}

try { main(); } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
}
