const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const htmlFiles = [];
const errors = [];
const warnings = [];
let imagesChecked = 0;
let localImagesChecked = 0;
let imagesWithoutDimensions = 0;
let imagesWithoutLoadingHint = 0;

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
    }
}

function decode(value) {
    return String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x([\da-f]{1,6});/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

function attributes(tag) {
    const result = {};
    const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g;
    let match;
    while ((match = pattern.exec(tag))) {
        result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return result;
}

function resolveLocalImage(src, htmlFile) {
    let pathname;
    try {
        const url = new URL(src, "https://blog.matrixqr.cc/");
        if (url.origin !== "https://blog.matrixqr.cc") return null;
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return null;
    }
    const target = pathname.startsWith("/")
        ? path.resolve(ROOT, "." + pathname)
        : path.resolve(path.dirname(htmlFile), pathname);
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
    return target;
}

walk(ROOT);

for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const label = path.relative(ROOT, file).replace(/\\/g, "/");
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
        imagesChecked++;
        const attrs = attributes(match[0]);
        const where = label + ": <img> #" + imagesChecked;

        if (!Object.prototype.hasOwnProperty.call(attrs, "alt")) {
            errors.push(where + " is missing an alt attribute.");
        }
        if (!attrs.src) {
            warnings.push(where + " has no src attribute (check whether it uses srcset or script-driven loading).");
            continue;
        }

        const target = resolveLocalImage(attrs.src, file);
        if (target) {
            localImagesChecked++;
            if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
                errors.push(label + ': local image "' + attrs.src + '" does not resolve to a file (' + path.relative(ROOT, target).replace(/\\/g, "/") + ").");
            }
        }

        if (!(Number(attrs.width) > 0) || !(Number(attrs.height) > 0)) {
            imagesWithoutDimensions++;
            warnings.push(where + " lacks explicit positive width and height; use the image's real aspect ratio to reduce layout shift.");
        }
        if (!attrs.loading) {
            imagesWithoutLoadingHint++;
            warnings.push(where + " has no loading hint; choose eager for the primary above-the-fold image and lazy for below-the-fold images.");
        }
        if (!attrs.decoding) {
            warnings.push(where + ' has no decoding hint; consider decoding="async" for non-critical images.');
        }
    }
}

console.log("HTML files scanned for images: " + htmlFiles.length);
console.log("Image elements checked: " + imagesChecked);
console.log("Local image references checked: " + localImagesChecked);
console.log("Images missing explicit dimensions: " + imagesWithoutDimensions);
console.log("Images missing loading hints: " + imagesWithoutLoadingHint);
console.log("Image validation warnings: " + warnings.length);
warnings.forEach(message => console.warn("WARN: " + message));
errors.forEach(message => console.error("ERROR: " + message));

if (errors.length) {
    console.error("Image validation failed with " + errors.length + " error(s).");
    process.exitCode = 1;
} else {
    console.log("Image validation passed (warnings are advisory while existing templates are migrated).");
}
