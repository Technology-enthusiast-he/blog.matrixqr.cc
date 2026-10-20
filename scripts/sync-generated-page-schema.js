const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_ORIGIN = "https://blog.matrixqr.cc";

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getMetaContent(html, attribute, key) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const tag = tags.find(item => {
        const match = item.match(new RegExp("\\b" + attribute + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
        return match && match[2].toLowerCase() === key.toLowerCase();
    });

    if (!tag) return "";

    const content = tag.match(/\bcontent\s*=\s*([\"'])([\s\S]*?)\1/i);
    return content ? content[2] : "";
}

function getPageTitle(html) {
    const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match ? match[1].trim() : "";
}

function getJsonLdBlocks(html) {
    return [...html.matchAll(
        /<script\b[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi
    )].map(match => ({
        full: match[0],
        jsonText: match[1].trim()
    }));
}

function updateCollectionPageNode(value, pageUrl, title, description) {
    let changed = false;

    const updateNode = node => {
        if (!node || typeof node !== "object") return;

        const types = Array.isArray(node["@type"])
            ? node["@type"]
            : [node["@type"]];

        if (!types.includes("CollectionPage")) return;

        if (node.url !== pageUrl) {
            node.url = pageUrl;
            changed = true;
        }

        const expectedId = pageUrl + "#webpage";
        if (node["@id"] !== expectedId) {
            node["@id"] = expectedId;
            changed = true;
        }

        const desiredPartOf = { "@id": SITE_ORIGIN + "/#website" };
        if (JSON.stringify(node.isPartOf) !== JSON.stringify(desiredPartOf)) {
            node.isPartOf = desiredPartOf;
            changed = true;
        }

        const desiredPublisher = { "@id": SITE_ORIGIN + "/#organization" };
        if (JSON.stringify(node.publisher) !== JSON.stringify(desiredPublisher)) {
            node.publisher = desiredPublisher;
            changed = true;
        }

        if (title && node.name !== title) {
            node.name = title;
            changed = true;
        }

        if (description && node.description !== description) {
            node.description = description;
            changed = true;
        }
    };

    if (Array.isArray(value)) {
        value.forEach(updateNode);
    } else if (value && Array.isArray(value["@graph"])) {
        value["@graph"].forEach(updateNode);
    } else {
        updateNode(value);
    }

    return changed;
}

function updateJsonLd(html, pageUrl) {
    const title = getPageTitle(html);
    const description = getMetaContent(html, "name", "description");
    let changed = false;

    html = html.replace(
        /<script\b[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi,
        (full, jsonText) => {
            let value;

            try {
                value = JSON.parse(jsonText.trim());
            } catch {
                return full;
            }

            if (!updateCollectionPageNode(value, pageUrl, title, description)) {
                return full;
            }

            changed = true;
            return full.replace(
                jsonText,
                "\n" + JSON.stringify(value, null, 2) + "\n"
            );
        }
    );

    return { html, changed };
}

function getGeneratedPages() {
    const pages = [];

    const homepage = path.join(ROOT, "index.html");
    if (fs.existsSync(homepage)) {
        pages.push({ file: homepage, url: SITE_ORIGIN + "/" });
    }

    const homepagePageRoot = path.join(ROOT, "page");
    if (fs.existsSync(homepagePageRoot)) {
        for (const entry of fs.readdirSync(homepagePageRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
            const file = path.join(homepagePageRoot, entry.name, "index.html");
            if (fs.existsSync(file)) {
                pages.push({
                    file,
                    url: `${SITE_ORIGIN}/page/${entry.name}/`
                });
            }
        }
    }

    const archive = path.join(ROOT, "posts", "index.html");
    if (fs.existsSync(archive)) {
        pages.push({ file: archive, url: SITE_ORIGIN + "/posts/" });
    }

    const archivePageRoot = path.join(ROOT, "posts", "page");
    if (fs.existsSync(archivePageRoot)) {
        for (const entry of fs.readdirSync(archivePageRoot, { withFileTypes: true })) {
            if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
            const file = path.join(archivePageRoot, entry.name, "index.html");
            if (fs.existsSync(file)) {
                pages.push({
                    file,
                    url: `${SITE_ORIGIN}/posts/page/${entry.name}/`
                });
            }
        }
    }

    return pages;
}

function main() {
    const pages = getGeneratedPages();
    let changed = 0;

    for (const page of pages) {
        const original = fs.readFileSync(page.file, "utf8");
        const result = updateJsonLd(original, page.url);

        if (!result.changed || result.html === original) continue;

        fs.writeFileSync(page.file, result.html, "utf8");
        changed += 1;
    }

    console.log(`[seo] Synchronized CollectionPage JSON-LD on ${changed} generated page(s).`);
}

main();
