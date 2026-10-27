const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_ORIGIN = "https://blog.matrixqr.cc";
const POSTS_FILE = path.join(ROOT, "posts.json");
const HTML_SITEMAP_FILE = path.join(ROOT, "sitemap", "index.html");

const errors = [];
const warnings = [];

function fail(message) { errors.push(message); }
function warn(message) { warnings.push(message); }

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

function canonicalizeUrl(value) {
    try {
        const url = new URL(decodeEntities(value), SITE_ORIGIN);
        if (url.origin !== SITE_ORIGIN) return "";
        const pathname = url.pathname.replace(/\/+$/, "") || "/";
        return SITE_ORIGIN + pathname;
    } catch {
        return "";
    }
}

function extractCanonical(html) {
    const match = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    return match ? decodeEntities(match[1]) : "";
}

function extractMeta(html, attribute, key) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const tag = tags.find(item => {
        const match = item.match(new RegExp("\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return match && match[2].toLowerCase() === key.toLowerCase();
    });
    if (!tag) return "";
    const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
    return content ? decodeEntities(content[2]) : "";
}

function extractTitle(html) {
    const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match ? decodeEntities(match[1].trim()) : "";
}

function extractJsonLd(html, label) {
    const blocks = [];
    for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            blocks.push(JSON.parse(match[1].trim()));
        } catch {
            fail(`${label}: invalid JSON-LD block found.`);
        }
    }
    return blocks;
}

function flattenJsonLd(value) {
    const nodes = [];
    const visit = node => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        nodes.push(node);
        if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
    };
    visit(value);
    return nodes;
}

function getTypes(node) {
    return Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
}

function isArticleNode(node) {
    return getTypes(node).some(type => type === "Article" || type === "BlogPosting");
}

function isCollectionPageNode(node) {
    return getTypes(node).includes("CollectionPage");
}

function getMainEntityUrl(node) {
    const value = node?.mainEntityOfPage;
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return value["@id"] || value.url || "";
    return "";
}

function normalizeImageUrl(value) {
    try {
        return new URL(decodeEntities(value), SITE_ORIGIN).href;
    } catch {
        return "";
    }
}

function getSchemaImageUrls(value) {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(getSchemaImageUrls);
    if (value && typeof value === "object") {
        const url = value.url || value.contentUrl || value["@id"];
        return typeof url === "string" ? [url] : [];
    }
    return [];
}

function isValidDate(value) {
    return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function getSchemaUrl(value) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return value.url || value["@id"] || "";
    return "";
}

function getNamedEntity(value) {
    return Array.isArray(value) ? value[0] : value;
}

function isValidHttpUrl(value) {
    try {
        const url = new URL(decodeEntities(value));
        return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
    } catch {
        return false;
    }
}

function isInternalPageUrl(value) {
    try {
        const url = new URL(decodeEntities(value), SITE_ORIGIN);
        return url.origin === SITE_ORIGIN && !url.username && !url.password;
    } catch {
        return false;
    }
}

function getGeneratedPageFiles() {
    const pages = [];
    const addNumericPages = (root, prefix) => {
        if (!fs.existsSync(root)) return;
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
            const file = path.join(root, entry.name, "index.html");
            if (fs.existsSync(file)) pages.push({ file, expectedUrl: `${SITE_ORIGIN}${prefix}${entry.name}/` });
        }
    };

    const homepage = path.join(ROOT, "index.html");
    if (fs.existsSync(homepage)) pages.push({ file: homepage, expectedUrl: SITE_ORIGIN + "/" });
    addNumericPages(path.join(ROOT, "page"), "/page/");

    const archive = path.join(ROOT, "posts", "index.html");
    if (fs.existsSync(archive)) pages.push({ file: archive, expectedUrl: SITE_ORIGIN + "/posts/" });
    addNumericPages(path.join(ROOT, "posts", "page"), "/posts/page/");

    return pages;
}

function validateGeneratedPage(file, expectedUrl) {
    const html = fs.readFileSync(file, "utf8");
    const label = path.relative(ROOT, file);
    const canonical = canonicalizeUrl(extractCanonical(html));
    const expectedCanonical = canonicalizeUrl(expectedUrl);

    if (!canonical) fail(`${label}: missing or invalid canonical URL.`);
    else if (canonical !== expectedCanonical) fail(`${label}: canonical is ${canonical}, expected ${expectedCanonical}.`);

    const ogUrl = canonicalizeUrl(extractMeta(html, "property", "og:url"));
    if (!ogUrl) fail(`${label}: missing or invalid og:url.`);
    else if (ogUrl !== expectedCanonical) fail(`${label}: og:url is ${ogUrl}, expected ${expectedCanonical}.`);

    const title = extractTitle(html);
    const ogTitle = extractMeta(html, "property", "og:title");
    const twitterTitle = extractMeta(html, "name", "twitter:title");
    if (!ogTitle) fail(`${label}: missing og:title.`);
    if (!twitterTitle) fail(`${label}: missing twitter:title.`);
    if (title && ogTitle && title !== ogTitle) warn(`${label}: title and og:title use different wording.`);
    if (title && twitterTitle && title !== twitterTitle) warn(`${label}: title and twitter:title use different wording.`);

    const description = extractMeta(html, "name", "description");
    const ogDescription = extractMeta(html, "property", "og:description");
    const twitterDescription = extractMeta(html, "name", "twitter:description");
    if (!description) fail(`${label}: missing meta description.`);
    if (!ogDescription) fail(`${label}: missing og:description.`);
    if (!twitterDescription) fail(`${label}: missing twitter:description.`);
    if (description && ogDescription && description !== ogDescription) warn(`${label}: meta description and og:description use different wording.`);
    if (description && twitterDescription && description !== twitterDescription) warn(`${label}: meta description and twitter:description use different wording.`);

    const collectionNodes = extractJsonLd(html, label).flatMap(flattenJsonLd).filter(isCollectionPageNode);
    if (collectionNodes.length === 0) fail(`${label}: no CollectionPage JSON-LD node found.`);

    for (const node of collectionNodes) {
        const nodeUrl = canonicalizeUrl(node.url || node["@id"] || "");
        if (!nodeUrl || nodeUrl !== expectedCanonical) {
            fail(`${label}: CollectionPage JSON-LD URL is ${node.url || node["@id"] || "missing"}, expected ${expectedCanonical}.`);
        }

        if (title && node.name && node.name !== title) warn(`${label}: CollectionPage name uses different wording from <title>.`);

        if (node.description) {
            const descriptions = [description, ogDescription, twitterDescription].filter(Boolean);
            if (!descriptions.includes(node.description)) {
                fail(`${label}: CollectionPage description differs from the page's meta/social descriptions.`);
            }
        } else {
            fail(`${label}: CollectionPage JSON-LD is missing description.`);
        }
    }
}

function walkHtmlFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walkHtmlFiles(fullPath));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(fullPath);
    }
    return files;
}

function isArticleSourceFile(file) {
    const relative = path.relative(path.join(ROOT, "posts"), file).replace(/\\/g, "/").toLowerCase();
    if (relative === "index.html" || relative === "privacy-policy.html") return false;
    if (/^page\/\d+\/index\.html$/.test(relative)) return false;
    return true;
}

function validateArticle(file) {
    const html = fs.readFileSync(file, "utf8");
    const label = path.relative(ROOT, file);
    const canonical = canonicalizeUrl(extractCanonical(html));
    if (!canonical) {
        fail(`${label}: missing or invalid canonical URL.`);
        return;
    }

    const articleNodes = extractJsonLd(html, label).flatMap(flattenJsonLd).filter(isArticleNode);
    if (articleNodes.length === 0) {
        fail(`${label}: no Article/BlogPosting JSON-LD node found.`);
        return;
    }

    const description = extractMeta(html, "name", "description");
    const ogDescription = extractMeta(html, "property", "og:description");
    const twitterDescription = extractMeta(html, "name", "twitter:description");
    const ogImage = extractMeta(html, "property", "og:image");
    const publishedTime = extractMeta(html, "property", "article:published_time");
    const modifiedTime = extractMeta(html, "property", "article:modified_time");

    if (!description) fail(`${label}: missing meta description.`);
    if (!ogDescription) fail(`${label}: missing og:description.`);
    else if (description && ogDescription !== description) {
        fail(`${label}: og:description differs from meta description.`);
    }
    if (!twitterDescription) fail(`${label}: missing twitter:description.`);
    else if (description && twitterDescription !== description) {
        fail(`${label}: twitter:description differs from meta description.`);
    }

    const allNodes = extractJsonLd(html, label).flatMap(flattenJsonLd);
    const breadcrumbNodes = allNodes.filter(node => getTypes(node).includes("BreadcrumbList"));
    if (breadcrumbNodes.length === 0) {
        fail(`${label}: no BreadcrumbList JSON-LD node found.`);
    } else if (breadcrumbNodes.length > 1) {
        warn(`${label}: multiple BreadcrumbList JSON-LD nodes found.`);
    }

    for (const breadcrumb of breadcrumbNodes) {
        const items = Array.isArray(breadcrumb.itemListElement) ? breadcrumb.itemListElement : [];
        if (items.length < 2) {
            fail(`${label}: BreadcrumbList must contain at least Home and article entries.`);
            continue;
        }
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const expectedPosition = i + 1;
            if (item.position !== expectedPosition) {
                fail(`${label}: BreadcrumbList item ${i + 1} has position ${item.position ?? "missing"}, expected ${expectedPosition}.`);
            }
            const itemUrl = getSchemaUrl(item.item);
            if (!itemUrl || !isInternalPageUrl(itemUrl)) {
                fail(`${label}: BreadcrumbList item ${i + 1} has a missing or non-site URL.`);
            }
        }
        const firstUrl = canonicalizeUrl(getSchemaUrl(items[0]?.item));
        if (firstUrl !== SITE_ORIGIN + "/") {
            fail(`${label}: BreadcrumbList first item must link to the site homepage.`);
        }
        const lastUrl = canonicalizeUrl(getSchemaUrl(items[items.length - 1]?.item));
        if (!lastUrl || lastUrl !== canonical) {
            fail(`${label}: BreadcrumbList final item must match the article canonical URL.`);
        }
    }

    for (const node of articleNodes) {
        const author = getNamedEntity(node.author);
        if (!author || !getTypes(author).includes("Organization") || !String(author.name || "").trim() || !isValidHttpUrl(author.url)) {
            fail(`${label}: Article/BlogPosting author must be an Organization with a name and valid URL.`);
        }

        const publisher = getNamedEntity(node.publisher);
        if (!publisher || !getTypes(publisher).includes("Organization") || !String(publisher.name || "").trim() || !isValidHttpUrl(publisher.url)) {
            fail(`${label}: Article/BlogPosting publisher must be an Organization with a name and valid URL.`);
        } else {
            const logoUrl = getSchemaUrl(publisher.logo);
            if (!logoUrl || !isInternalPageUrl(logoUrl)) {
                fail(`${label}: Article/BlogPosting publisher logo must have a valid URL on the blog site.`);
            }
        }

        const mainEntityUrl = canonicalizeUrl(getMainEntityUrl(node));
        if (!mainEntityUrl) fail(`${label}: Article JSON-LD is missing mainEntityOfPage.`);
        else if (mainEntityUrl !== canonical) fail(`${label}: mainEntityOfPage is ${mainEntityUrl}, expected ${canonical}.`);

        if (!node.description) {
            fail(`${label}: Article/BlogPosting JSON-LD is missing description.`);
        } else if (description && node.description !== description) {
            fail(`${label}: Article/BlogPosting description differs from meta description.`);
        }

        const schemaImages = getSchemaImageUrls(node.image).map(normalizeImageUrl).filter(Boolean);
        const normalizedOgImage = normalizeImageUrl(ogImage);
        if (!ogImage) {
            fail(`${label}: missing og:image.`);
        } else if (!schemaImages.length) {
            fail(`${label}: Article/BlogPosting JSON-LD is missing a usable image URL.`);
        } else if (!normalizedOgImage || !schemaImages.includes(normalizedOgImage)) {
            fail(`${label}: Article/BlogPosting image does not include the og:image URL.`);
        }

        if (!publishedTime || !isValidDate(publishedTime)) {
            fail(`${label}: missing or invalid article:published_time.`);
        }
        if (!modifiedTime || !isValidDate(modifiedTime)) {
            fail(`${label}: missing or invalid article:modified_time.`);
        }
        if (!isValidDate(node.datePublished)) {
            fail(`${label}: Article/BlogPosting JSON-LD has missing or invalid datePublished.`);
        } else if (publishedTime && node.datePublished !== publishedTime) {
            fail(`${label}: datePublished differs from article:published_time.`);
        }
        if (!isValidDate(node.dateModified)) {
            fail(`${label}: Article/BlogPosting JSON-LD has missing or invalid dateModified.`);
        } else if (modifiedTime && node.dateModified !== modifiedTime) {
            fail(`${label}: dateModified differs from article:modified_time.`);
        }
        if (isValidDate(node.datePublished) && isValidDate(node.dateModified) && Date.parse(node.dateModified) < Date.parse(node.datePublished)) {
            fail(`${label}: dateModified is earlier than datePublished.`);
        }
    }
}

function validateHtmlSitemap(posts) {
    if (!fs.existsSync(HTML_SITEMAP_FILE)) {
        fail("HTML sitemap file is missing: sitemap/index.html");
        return;
    }

    const html = fs.readFileSync(HTML_SITEMAP_FILE, "utf8");
    const start = html.indexOf("<!-- AUTO-SITEMAP-START -->");
    const end = html.indexOf("<!-- AUTO-SITEMAP-END -->");
    if (start === -1 || end === -1 || end < start) {
        fail("HTML sitemap: automatic sitemap markers are missing or misplaced.");
        return;
    }

    const body = html.slice(start, end);
    const hrefs = [...body.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)].map(match => decodeEntities(match[2]));
    const expected = new Map();
    for (const post of posts) {
        const normalized = normalizeUrl(post.url);
        if (normalized) expected.set(normalized, post.url);
    }

    const actual = new Map();
    for (const href of hrefs) {
        const normalized = normalizeUrl(href);
        if (!normalized || !expected.has(normalized)) continue;
        if (!actual.has(normalized)) actual.set(normalized, []);
        actual.get(normalized).push(href);
    }

    for (const [normalized, canonical] of expected.entries()) {
        const links = actual.get(normalized) || [];
        if (links.length === 0) {
            fail(`HTML sitemap: missing article link for ${canonical}.`);
            continue;
        }

        for (const href of links) {
            const resolved = canonicalizeUrl(href);
            if (resolved !== canonicalizeUrl(canonical)) fail(`HTML sitemap: ${href} does not match canonical ${canonical}.`);
            if (!/^https:\/\/blog\.matrixqr\.cc\//i.test(href)) fail(`HTML sitemap: article link is not an absolute canonical URL: ${href}.`);
        }

        if (links.length > 1) warn(`HTML sitemap: article ${canonical} appears ${links.length} times.`);
    }
}

function main() {
    if (!fs.existsSync(POSTS_FILE)) throw new Error("posts.json not found.");
    const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
    if (!Array.isArray(posts)) throw new Error("posts.json must contain an array.");

    const generatedPages = getGeneratedPageFiles();
    generatedPages.forEach(page => validateGeneratedPage(page.file, page.expectedUrl));

    const articleFiles = walkHtmlFiles(path.join(ROOT, "posts")).filter(isArticleSourceFile);
    articleFiles.forEach(validateArticle);

    validateHtmlSitemap(posts);

    console.log("");
    console.log("======================================");
    console.log(" MatrixQR SEO & Structured Data Consistency");
    console.log("======================================");
    console.log(`Generated archive/homepage pages checked: ${generatedPages.length}`);
    console.log(`Article pages checked: ${articleFiles.length}`);
    console.log(`HTML sitemap articles checked: ${posts.length}`);

    if (warnings.length) {
        console.log("\nWarnings:");
        warnings.forEach(message => console.warn("- " + message));
    }

    if (errors.length) {
        console.error("\nSEO consistency errors:");
        errors.forEach(message => console.error("- " + message));
        process.exit(1);
    }

    console.log("PASS: canonical/og:url, CollectionPage URLs, article descriptions/images/dates, author/publisher entities, BreadcrumbList URLs/positions, mainEntityOfPage, and HTML sitemap targets are consistent.");
}

try {
    main();
} catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
}
