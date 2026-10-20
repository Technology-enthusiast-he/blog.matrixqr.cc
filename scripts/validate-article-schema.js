const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const ARTICLE_TYPES = new Set(["Article", "BlogPosting", "NewsArticle"]);

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    const results = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walk(fullPath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
            const relative = path.relative(POSTS_DIR, fullPath).split(path.sep).join("/");
            if (
                relative === "index.html" ||
                relative === "privacy-policy.html" ||
                relative === "page/index.html" ||
                /^page\/\d+\/index\.html$/.test(relative)
            ) continue;
            results.push(fullPath);
        }
    }

    return results;
}

function getJsonLdBlocks(html, file) {
    const blocks = [];
    const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(pattern)) {
        try {
            blocks.push(JSON.parse(match[1].trim()));
        } catch (error) {
            throw new Error(`${file}: invalid JSON-LD: ${error.message}`);
        }
    }

    return blocks;
}

function flattenSchema(value) {
    const items = Array.isArray(value) ? value : [value];
    return items.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const own = [item];
        if (Array.isArray(item["@graph"])) own.push(...flattenSchema(item["@graph"]));
        return own;
    });
}

function normalizeUrl(value) {
    if (typeof value !== "string") return "";
    try {
        const url = new URL(value);
        return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
    } catch {
        return "";
    }
}

function normalizeText(value) {
    return String(value || "")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getVisibleText(html) {
    return normalizeText(
        html
            .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    );
}

function main() {
    const files = walk(POSTS_DIR);
    const failures = [];
    let checked = 0;

    for (const filePath of files) {
        const relative = path.relative(ROOT, filePath).split(path.sep).join("/");
        const html = fs.readFileSync(filePath, "utf8");
        const blocks = getJsonLdBlocks(html, relative);
        const schemas = blocks.flatMap(flattenSchema);
        const visibleText = getVisibleText(html);
        const articles = schemas.filter(item => {
            const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
            return types.some(type => ARTICLE_TYPES.has(type));
        });

        if (!articles.length) {
            failures.push(`${relative}: missing Article/BlogPosting JSON-LD`);
            continue;
        }

        const canonicalMatch = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
        const canonical = canonicalMatch
            ? (canonicalMatch[0].match(/\bhref=["']([^"']+)["']/i) || [])[1]
            : "";
        if (!canonical) failures.push(`${relative}: missing canonical link`);

        for (const faq of schemas.filter(item => item["@type"] === "FAQPage")) {
            for (const question of faq.mainEntity || []) {
                const questionText = normalizeText(question.name);
                const answerText = normalizeText(question.acceptedAnswer && question.acceptedAnswer.text);
                if (questionText && !visibleText.includes(questionText)) {
                    failures.push(`${relative}: FAQPage question is not visible in the article: ${question.name}`);
                }
                if (answerText && !visibleText.includes(answerText)) {
                    failures.push(`${relative}: FAQPage answer is not visible in the article: ${question.name}`);
                }
            }
        }

        for (const article of articles) {
            checked += 1;
            if (!article.headline || typeof article.headline !== "string") {
                failures.push(`${relative}: Article schema is missing headline`);
            }
            if (!article.datePublished || Number.isNaN(Date.parse(article.datePublished))) {
                failures.push(`${relative}: Article schema has missing/invalid datePublished`);
            }
            if (!article.dateModified || Number.isNaN(Date.parse(article.dateModified))) {
                failures.push(`${relative}: Article schema has missing/invalid dateModified`);
            }
            if (!article.author || article.author["@type"] !== "Organization" || !article.author.name) {
                failures.push(`${relative}: author must be a named Organization (run schema normalization before validation)`);
            }
            const pageId = typeof article.mainEntityOfPage === "string"
                ? article.mainEntityOfPage
                : article.mainEntityOfPage && article.mainEntityOfPage["@id"];
            if (!pageId) {
                failures.push(`${relative}: Article schema is missing mainEntityOfPage.@id`);
            } else if (canonical && normalizeUrl(pageId) !== normalizeUrl(canonical)) {
                failures.push(`${relative}: canonical URL does not match mainEntityOfPage.@id`);
            }
            if (!article.image) {
                failures.push(`${relative}: Article schema is missing image`);
            }
        }
    }

    if (failures.length) {
        console.error(`Article schema validation failed with ${failures.length} issue(s):`);
        for (const failure of failures) console.error(`- ${failure}`);
        process.exitCode = 1;
        return;
    }

    console.log(`PASS: validated ${checked} Article/BlogPosting schema block(s) across ${files.length} article page(s).`);
    console.log("PASS: JSON-LD is parseable; author, dates, canonical identity, headline, and image fields are present.");
}

if (require.main === module) main();

module.exports = { flattenSchema, normalizeUrl, getJsonLdBlocks };
