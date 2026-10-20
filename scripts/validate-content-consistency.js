const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_ORIGIN = "https://blog.matrixqr.cc";
const POSTS_FILE = path.join(ROOT, "posts.json");
const HOME_FILE = path.join(ROOT, "index.html");
const HTML_SITEMAP_FILE = path.join(ROOT, "sitemap", "index.html");
const XML_SITEMAP_FILE = path.join(ROOT, "sitemap.xml");

const errors = [];

function fail(message) {
    errors.push(message);
}

function decodeEntities(value = "") {
    return String(value)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function normalizeUrl(value) {
    try {
        const url = new URL(decodeEntities(value), SITE_ORIGIN);
        if (url.origin !== SITE_ORIGIN) return "";
        let pathname = url.pathname;
        try { pathname = decodeURIComponent(pathname); } catch {}
        return pathname.replace(/\/+$/, "").toLowerCase() || "/";
    } catch {
        return "";
    }
}

function extractHrefs(html) {
    return [...html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)]
        .map(match => decodeEntities(match[2]));
}

function markerContent(html, startMarker, endMarker, label) {
    const start = html.indexOf(startMarker);
    const end = html.indexOf(endMarker);
    if (start === -1 || end === -1 || end < start) {
        fail(label + ": missing or misplaced markers.");
        return "";
    }
    if (html.indexOf(startMarker, start + startMarker.length) !== -1) {
        fail(label + ": start marker appears more than once.");
    }
    if (html.indexOf(endMarker, end + endMarker.length) !== -1) {
        fail(label + ": end marker appears more than once.");
    }
    return html.slice(start + startMarker.length, end);
}

function getNumericPageDirs(parentDir) {
    if (!fs.existsSync(parentDir)) return [];
    return fs.readdirSync(parentDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map(entry => Number(entry.name))
        .filter(page => page >= 2 && fs.existsSync(path.join(parentDir, String(page), "index.html")))
        .sort((a, b) => a - b);
}

function pageArticlePaths(html, label, startMarker, endMarker) {
    const body = markerContent(html, startMarker, endMarker, label);
    const paths = [];
    for (const href of extractHrefs(body)) {
        const normalized = normalizeUrl(href);
        if (normalized && normalized.startsWith("/posts/") && normalized !== "/posts") {
            paths.push(normalized);
        }
    }
    return paths;
}

function checkExactCoverage(label, expectedPaths, actualPaths) {
    const expected = new Set(expectedPaths);
    const counts = new Map();
    for (const url of actualPaths) counts.set(url, (counts.get(url) || 0) + 1);
    const missing = [...expected].filter(url => !counts.has(url));
    const unexpected = [...counts.keys()].filter(url => !expected.has(url));
    const repeated = [...counts.entries()].filter(([, count]) => count > 1).map(([url]) => url);
    if (missing.length) fail(label + ": missing " + missing.length + " article(s): " + missing.join(", "));
    if (unexpected.length) fail(label + ": contains unexpected article URL(s): " + unexpected.join(", "));
    if (repeated.length) fail(label + ": repeats article URL(s): " + repeated.join(", "));
}

function main() {
    for (const file of [POSTS_FILE, HOME_FILE, HTML_SITEMAP_FILE, XML_SITEMAP_FILE]) {
        if (!fs.existsSync(file)) fail("Required generated file is missing: " + path.relative(ROOT, file));
    }
    if (errors.length) throw new Error(errors.join("\n"));

    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
    if (!Array.isArray(posts)) throw new Error("posts.json must contain an array.");

    const postPaths = [];
    const postUrlCounts = new Map();
    for (const [index, post] of posts.entries()) {
        const normalized = normalizeUrl(post.url);
        if (!normalized) {
            fail("posts.json item " + (index + 1) + " has an invalid or off-site URL: " + post.url);
            continue;
        }
        postPaths.push(normalized);
        postUrlCounts.set(normalized, (postUrlCounts.get(normalized) || 0) + 1);
    }
    const duplicateIndexUrls = [...postUrlCounts.entries()].filter(([, count]) => count > 1).map(([url]) => url);
    if (duplicateIndexUrls.length) fail("posts.json contains duplicate normalized URLs: " + duplicateIndexUrls.join(", "));

    const homepage = fs.readFileSync(HOME_FILE, "utf8");
    const featuredStartMarker = "<!-- Section 1: Featured & Recommendation -->";
    const featuredEndMarker = "<!-- Section 4: Latest Articles -->";
    const featuredStart = homepage.indexOf(featuredStartMarker);
    const featuredEnd = homepage.indexOf(featuredEndMarker);
    if (featuredStart === -1 || featuredEnd === -1 || featuredEnd < featuredStart) {
        fail("Homepage: featured/category section markers are missing or misplaced.");
    }

    const featuredPaths = new Set();
    if (featuredStart !== -1 && featuredEnd > featuredStart) {
        for (const href of extractHrefs(homepage.slice(featuredStart, featuredEnd))) {
            const normalized = normalizeUrl(href);
            if (normalized && postUrlCounts.has(normalized)) featuredPaths.add(normalized);
        }
    }

    const latestExpected = [...new Set(postPaths)].filter(url => !featuredPaths.has(url));
    const latestActual = pageArticlePaths(
        homepage,
        "Homepage Latest Articles",
        "<!-- AUTO-POSTS-START -->",
        "<!-- AUTO-POSTS-END -->"
    );
    const homepagePaginationPages = getNumericPageDirs(path.join(ROOT, "page"));
    const homepagePageFiles = [
        HOME_FILE,
        ...homepagePaginationPages.map(page => path.join(ROOT, "page", String(page), "index.html"))
    ];
    const homepagePaginationActual = [...latestActual];
    for (const file of homepagePageFiles.slice(1)) {
        const html = fs.readFileSync(file, "utf8");
        if (!html.includes("<!-- AUTO-GENERATED-PAGINATION-PAGE -->")) {
            fail("Homepage pagination: " + path.relative(ROOT, file) + " lacks the generated-page marker.");
        }
        homepagePaginationActual.push(...pageArticlePaths(
            html,
            "Homepage pagination " + path.relative(ROOT, file),
            "<!-- AUTO-POSTS-START -->",
            "<!-- AUTO-POSTS-END -->"
        ));
    }
    checkExactCoverage("Homepage pagination (excluding homepage featured/category articles)", latestExpected, homepagePaginationActual);

    const archivePageRoot = path.join(ROOT, "posts", "page");
    const archivePageNumbers = getNumericPageDirs(archivePageRoot);
    const archiveFiles = [
        path.join(ROOT, "posts", "index.html"),
        ...archivePageNumbers.map(page => path.join(archivePageRoot, String(page), "index.html"))
    ];
    const archiveActual = [];
    for (const file of archiveFiles) {
        if (!fs.existsSync(file)) {
            fail("Article archive page is missing: " + path.relative(ROOT, file));
            continue;
        }
        const html = fs.readFileSync(file, "utf8");
        if (!html.includes("<!-- AUTO-GENERATED-ARCHIVE-PAGE -->")) {
            fail("Article archive: " + path.relative(ROOT, file) + " lacks the generated-page marker.");
        }
        const uniqueOnPage = new Set();
        for (const href of extractHrefs(html)) {
            const normalized = normalizeUrl(href);
            if (normalized && postUrlCounts.has(normalized)) uniqueOnPage.add(normalized);
        }
        archiveActual.push(...uniqueOnPage);
    }
    checkExactCoverage("Article archive pagination", [...new Set(postPaths)], archiveActual);

    const htmlSitemap = fs.readFileSync(HTML_SITEMAP_FILE, "utf8");
    const htmlSitemapBody = markerContent(
        htmlSitemap,
        "<!-- AUTO-SITEMAP-START -->",
        "<!-- AUTO-SITEMAP-END -->",
        "HTML sitemap article sections"
    );
    const htmlSitemapPaths = extractHrefs(htmlSitemapBody)
        .map(normalizeUrl)
        .filter(url => url && postUrlCounts.has(url));
    checkExactCoverage("HTML sitemap category sections", [...new Set(postPaths)], htmlSitemapPaths);

    const xml = fs.readFileSync(XML_SITEMAP_FILE, "utf8");
    if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml)) {
        fail("XML sitemap is missing the expected urlset namespace.");
    }
    const xmlUrls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
        .map(match => decodeEntities(match[1].trim()));
    const xmlPaths = xmlUrls.map(normalizeUrl);
    const xmlPathCounts = new Map();
    for (const url of xmlPaths) {
        if (!url) fail("XML sitemap contains an invalid or off-site URL.");
        else xmlPathCounts.set(url, (xmlPathCounts.get(url) || 0) + 1);
    }
    const duplicateXml = [...xmlPathCounts.entries()].filter(([, count]) => count > 1).map(([url]) => url);
    if (duplicateXml.length) fail("XML sitemap contains duplicate URLs: " + duplicateXml.join(", "));

    const expectedXmlPaths = new Set(["/", ...postPaths.filter(url => url !== "/posts/privacy-policy")]);
    if (fs.existsSync(path.join(ROOT, "posts", "index.html"))) expectedXmlPaths.add("/posts");
    for (const page of archivePageNumbers) expectedXmlPaths.add("/posts/page/" + page);
    for (const page of homepagePaginationPages) expectedXmlPaths.add("/page/" + page);

    const actualXmlPaths = new Set(xmlPaths.filter(Boolean));
    const missingXml = [...expectedXmlPaths].filter(url => !actualXmlPaths.has(url));
    const unexpectedXml = [...actualXmlPaths].filter(url => !expectedXmlPaths.has(url));
    if (missingXml.length) fail("XML sitemap is missing expected URLs: " + missingXml.join(", "));
    if (unexpectedXml.length) fail("XML sitemap contains unexpected URLs: " + unexpectedXml.join(", "));

    console.log("");
    console.log("======================================");
    console.log(" MatrixQR Content Consistency Check");
    console.log("======================================");
    console.log("Indexed articles: " + posts.length);
    console.log("Homepage pagination articles: " + latestExpected.length);
    console.log("Homepage pagination pages: " + homepagePageFiles.length);
    console.log("Archive articles: " + new Set(postPaths).size);
    console.log("Archive pages: " + archiveFiles.length);
    console.log("HTML sitemap article links: " + htmlSitemapPaths.length);
    console.log("XML sitemap URLs: " + xmlUrls.length);

    if (errors.length) {
        console.error("\nConsistency errors:");
        errors.forEach(message => console.error("- " + message));
        process.exit(1);
    }
    console.log("PASS: pagination, archive, HTML sitemap, index and XML sitemap are consistent.");
}

try {
    main();
} catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
}
