const fs = require("fs");
const path = require("path");

const SITE_ORIGIN = "https://blog.matrixqr.cc";
const sitemapPath = process.argv[2] || "sitemap.xml";

function normalizeUrl(value) {
    try {
        const url = new URL(String(value).replace(/&amp;/g, "&").trim());
        const pathname = url.pathname.replace(/\/+$/, "") || "/";
        return url.origin + pathname;
    } catch {
        return String(value).trim();
    }
}

function readSitemapUrls(xml) {
    return new Set(
        [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)]
            .map(match => normalizeUrl(match[1]))
    );
}

function getGeneratedPaginationUrls(directory, urlPrefix) {
    const urls = new Set();
    if (!fs.existsSync(directory)) return urls;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;

        const pageNumber = Number(entry.name);
        if (pageNumber < 2) continue;

        const indexFile = path.join(directory, entry.name, "index.html");
        if (!fs.existsSync(indexFile)) continue;

        urls.add(normalizeUrl(SITE_ORIGIN + urlPrefix + pageNumber + "/"));
    }

    return urls;
}

if (!fs.existsSync(sitemapPath)) {
    throw new Error("Sitemap file not found: " + sitemapPath);
}

const sitemapUrls = readSitemapUrls(fs.readFileSync(sitemapPath, "utf8"));
const expectedUrls = new Set([
    ...getGeneratedPaginationUrls(path.join("page"), "/page/"),
    ...getGeneratedPaginationUrls(path.join("posts", "page"), "/posts/page/")
]);

const sitemapPaginationUrls = [...sitemapUrls].filter(url => {
    try {
        const pathname = new URL(url).pathname.replace(/\/+$/, "");
        return /^\/page\/\d+$/.test(pathname) || /^\/posts\/page\/\d+$/.test(pathname);
    } catch {
        return false;
    }
});

const stale = sitemapPaginationUrls.filter(url => !expectedUrls.has(url));
const missing = [...expectedUrls].filter(url => !sitemapUrls.has(url));

if (stale.length || missing.length) {
    const details = [];
    if (stale.length) {
        details.push("Sitemap contains pagination URL(s) without generated index.html: " + stale.join(", "));
    }
    if (missing.length) {
        details.push("Generated pagination page(s) missing from sitemap: " + missing.join(", "));
    }
    throw new Error(details.join("\n"));
}

console.log("PASS: sitemap pagination matches generated pagination pages.");
