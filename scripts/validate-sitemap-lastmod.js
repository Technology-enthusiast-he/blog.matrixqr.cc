const fs = require("fs");

const sitemapPath = process.argv[2];
if (!sitemapPath) {
    throw new Error("Usage: node scripts/validate-sitemap-lastmod.js <committed-sitemap-snapshot>");
}

const sitemapXml = fs.readFileSync(sitemapPath, "utf8");
const posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));

function normalizeUrl(value) {
    try {
        const url = new URL(value.replace(/&amp;/g, "&").trim());
        url.pathname = url.pathname.replace(/\/+$/, "") || "/";
        return url.origin + url.pathname;
    } catch {
        return value.trim();
    }
}

function isValidCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
}

const sitemapEntries = new Map();
for (const match of sitemapXml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)) {
    const block = match[1];
    const loc = (block.match(/<loc>([\s\S]*?)<\/loc>/) || [])[1];
    if (!loc) continue;
    const lastmod = (block.match(/<lastmod>([\s\S]*?)<\/lastmod>/) || [])[1];
    const normalizedLastmod = lastmod ? lastmod.trim().slice(0, 10) : "";
    if (lastmod && !isValidCalendarDate(normalizedLastmod)) {
        console.error("Invalid <lastmod> calendar date for " + normalizeUrl(loc) + ": " + lastmod.trim());
        process.exitCode = 1;
    }
    sitemapEntries.set(normalizeUrl(loc), normalizedLastmod);
}

const errors = [];
let checked = 0;

// Listing pages do not have a maintained content-modified date in the generator.
// Do not publish stale article dates as lastmod for the homepage, archive, or pagination.
for (const [url, lastmod] of sitemapEntries) {
    let pathname = "";
    try { pathname = new URL(url).pathname.replace(/\/+$/, "") || "/"; } catch {}
    const isListingPage =
        pathname === "/" ||
        pathname === "/posts" ||
        /^\/page\/\d+$/.test(pathname) ||
        /^\/posts\/page\/\d+$/.test(pathname);
    if (isListingPage && lastmod) {
        errors.push(url + " is a listing page and should not have <lastmod> unless its own modification date is maintained.");
    }
}

for (const post of posts) {
    let pathname;
    try {
        pathname = new URL(post.url).pathname.replace(/\/+$/, "") || "/";
    } catch {
        errors.push("Invalid indexed article URL: " + post.url);
        continue;
    }

    if (pathname === "/posts/privacy-policy") continue;

    const url = normalizeUrl(post.url);
    const expectedDate = String(post.dateModified || post.datePublished || "").slice(0, 10);
    if (!isValidCalendarDate(expectedDate)) {
        errors.push("Article has no valid calendar date in dateModified/datePublished: " + post.url + " (" + expectedDate + ")");
        continue;
    }

    if (!sitemapEntries.has(url)) {
        errors.push("Committed sitemap is missing article URL: " + url);
        continue;
    }

    const actualDate = sitemapEntries.get(url);
    if (actualDate !== expectedDate) {
        errors.push(url + " has lastmod " + (actualDate || "(missing)") + "; expected " + expectedDate);
    }
    checked++;
}

if (process.exitCode === 1) {
    errors.push("One or more sitemap <lastmod> values are not valid YYYY-MM-DD calendar dates.");
}

if (errors.length) {
    console.error("FAIL: committed sitemap lastmod consistency check:");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
}

console.log("PASS: committed sitemap lastmod matches dateModified/datePublished for " + checked + " indexed articles.");
