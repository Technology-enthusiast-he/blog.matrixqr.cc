const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");

const AUTHOR = {
    "@type": "Organization",
    "name": "MatrixQR Studio",
    "url": "https://www.matrixqr.cc/",
    "sameAs": [
        "https://www.matrixqr.cc/about"
    ]
};

function walk(dir) {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...walk(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".html")) {
            files.push(fullPath);
        }
    }

    return files;
}

function findMatchingObjectEnd(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
        const char = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === "{") depth += 1;
        if (char === "}") {
            depth -= 1;
            if (depth === 0) return i + 1;
        }
    }

    return -1;
}

function normalizeAuthors(html) {
    const marker = '"author"';
    let searchFrom = 0;
    let replacements = 0;

    while (true) {
        const authorIndex = html.indexOf(marker, searchFrom);
        if (authorIndex === -1) break;

        const colonIndex = html.indexOf(":", authorIndex + marker.length);
        if (colonIndex === -1) break;

        let valueStart = colonIndex + 1;
        while (/\s/.test(html[valueStart] || "")) valueStart += 1;

        if (html[valueStart] !== "{") {
            searchFrom = valueStart + 1;
            continue;
        }

        const valueEnd = findMatchingObjectEnd(html, valueStart);
        if (valueEnd === -1) {
            throw new Error(`Could not parse author object near offset ${authorIndex}.`);
        }

        const oldObject = html.slice(valueStart, valueEnd);
        const oldTypeMatch = oldObject.match(/"@type"\s*:\s*"([^"]+)"/);

        if (!oldTypeMatch || oldTypeMatch[1] !== "Person") {
            searchFrom = valueEnd;
            continue;
        }

        const replacement = JSON.stringify(AUTHOR, null, 10)
            .split("\n")
            .map((line, index) => index === 0 ? line : line.replace(/^ {10}/, ""))
            .join("\n");

        html = html.slice(0, valueStart) + replacement + html.slice(valueEnd);
        searchFrom = valueStart + replacement.length;
        replacements += 1;
    }

    return { html, replacements };
}

function main() {
    const files = walk(POSTS_DIR);
    let changedFiles = 0;
    let replacements = 0;

    for (const file of files) {
        const original = fs.readFileSync(file, "utf8");
        const result = normalizeAuthors(original);

        if (result.replacements === 0 || result.html === original) {
            continue;
        }

        fs.writeFileSync(file, result.html, "utf8");
        changedFiles += 1;
        replacements += result.replacements;
    }

    console.log(
        `[seo] Normalized ${replacements} Person author schema block(s) across ${changedFiles} article file(s).`
    );
}

main();
