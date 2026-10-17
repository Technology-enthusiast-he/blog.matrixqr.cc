const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_FILE = path.join(ROOT, "posts.json");
const OUTPUT_FILE = path.join(ROOT, "sitemap.xml");

const SITE_URL = "https://blog.matrixqr.cc";

function escapeXml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function main() {
    if (!fs.existsSync(POSTS_FILE)) {
        throw new Error(
            "找不到 posts.json，请先运行 generate-blog.js。"
        );
    }

    const posts = JSON.parse(
        fs.readFileSync(POSTS_FILE, "utf8")
    );

    if (!Array.isArray(posts)) {
        throw new Error("posts.json 必须是数组。");
    }

    const urls = new Map();

    function addUrl(url, lastmod) {
        if (
            typeof url !== "string" ||
            (!url.startsWith(SITE_URL + "/") && url !== SITE_URL)
        ) {
            return;
        }

        const date = lastmod
            ? String(lastmod).slice(0, 10)
            : "";

        if (!urls.has(url)) {
            urls.set(url, date);
        } else if (date && date > urls.get(url)) {
            urls.set(url, date);
        }
    }

    // Homepage and article URLs.
    addUrl(SITE_URL + "/", new Date().toISOString());

    for (const post of posts) {
        // The privacy policy is intentionally excluded from the XML sitemap.
        const pathname = (() => {
            try {
                return new URL(post.url, SITE_URL).pathname.replace(/\\/+$/, "");
            } catch {
                return "";
            }
        })();

        if (pathname === "/posts/privacy-policy") continue;

        addUrl(post.url, post.dateModified || post.datePublished);
    }

    // Add only pagination pages that were actually generated during this build.
    function addGeneratedPaginationPages(directory, urlPrefix) {
        if (!fs.existsSync(directory)) return;

        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) {
                continue;
            }

            const pageNumber = Number(entry.name);
            const indexFile = path.join(directory, entry.name, "index.html");

            if (pageNumber < 2 || !fs.existsSync(indexFile)) {
                continue;
            }

            addUrl(`${SITE_URL}${urlPrefix}${pageNumber}/`);
        }
    }

    // Archive page 1 is /posts/; numbered archive pages live under /posts/page/.
    if (fs.existsSync(path.join(ROOT, "posts", "index.html"))) {
        addUrl(`${SITE_URL}/posts/`);
    }
    addGeneratedPaginationPages(
        path.join(ROOT, "posts", "page"),
        "/posts/page/"
    );

    // Homepage pagination pages live under /page/.
    addGeneratedPaginationPages(
        path.join(ROOT, "page"),
        "/page/"
    );

    // The privacy policy is intentionally not added unless it is an article in posts.json.
    const entries = [...urls.entries()]
        .sort(([urlA], [urlB]) => urlA.localeCompare(urlB))
        .map(([url, lastmod]) => {
            const lastmodTag = lastmod
                ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
                : "";

            return `  <url>\n    <loc>${escapeXml(url)}</loc>${lastmodTag}\n  </url>`;
        })
        .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `${entries}\n` +
        `</urlset>\n`;

    fs.writeFileSync(OUTPUT_FILE, xml, "utf8");

    console.log(
        `XML sitemap generated: ${urls.size} URLs -> ${OUTPUT_FILE}`
    );
}

main();
