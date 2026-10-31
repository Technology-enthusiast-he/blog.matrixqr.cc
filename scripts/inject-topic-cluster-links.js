const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARKER = "<!-- SEO/GEO Topic Cluster Links -->";

const TOPIC_LINKS = {
  "posts/can-you-recommend-a-qr-code-generator-that-allows-customization.html": [],
  "posts/2026-10/traditional-menus-digital-menu-qr-code.html": [
    ["Convert a menu image into a QR code", "/posts/image-to-qr-menu-guide"],
    ["Add a custom logo to a restaurant QR menu", "/posts/custom-logo-qr-code-menu-guide"],
    ["How MatrixQR secures digital menu QR codes", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
  ],
  "posts/custom-logo-qr-code-menu-guide.html": [
    ["Convert an existing menu image into a QR code", "/posts/image-to-qr-menu-guide"],
    ["How MatrixQR secures digital menu QR codes", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
    ["Why restaurants can offer digital menus alongside paper", "/posts/2026-10/traditional-menus-digital-menu-qr-code"],
    ["Add a QR code logo without hurting scan reliability", "/posts/how-to-add-logo-to-qr-code-without-breaking-it"],
    ["Explore the custom QR code generator with logo options", "/posts/custom-qr-code-generator-logo"],
  ],
  "posts/custom-qr-code-generator-logo.html": [
    ["Add a logo to a QR code without breaking scan reliability", "/posts/how-to-add-logo-to-qr-code-without-breaking-it"],
    ["Create a custom logo QR menu for a restaurant", "/posts/custom-logo-qr-code-menu-guide"],
  ],
  "posts/how-to-add-logo-to-qr-code-without-breaking-it.html": [
    ["Create a custom logo QR menu for a restaurant", "/posts/custom-logo-qr-code-menu-guide"],
    ["Explore the custom QR code generator with logo options", "/posts/custom-qr-code-generator-logo"],
  ],
  "posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization.html": [
    ["Create a restaurant QR menu with a custom logo", "/posts/custom-logo-qr-code-menu-guide"],
    ["Why digital menus are useful alongside traditional menus", "/posts/2026-10/traditional-menus-digital-menu-qr-code"],
    ["Compare static and dynamic QR codes", "/posts/static-vs-dynamic-qr"],
    ["Review the pros and cons of static QR codes", "/posts/the-pros-and-cons-of-static-qr-codes"],
  ],
  "posts/static-vs-dynamic-qr.html": [
    ["Understand the pros and cons of static QR codes", "/posts/the-pros-and-cons-of-static-qr-codes"],
    ["See how digital menu QR codes are secured", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
    ["Generate a URL QR code without a cloud account", "/posts/2026-10/introducing-matrixqr-url-generator"],
    ["Create a vCard QR code locally", "/posts/vcard-qr-setup"],
  ],
  "posts/the-pros-and-cons-of-static-qr-codes.html": [
    ["Compare static and dynamic QR codes", "/posts/static-vs-dynamic-qr"],
    ["See how digital menu QR codes are secured", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
  ],
  "posts/2026-10/introducing-matrixqr-url-generator.html": [
    ["Compare static and dynamic QR codes", "/posts/static-vs-dynamic-qr"],
    ["Create a privacy-first vCard QR code", "/posts/vcard-qr-setup"],
  ],
  "posts/vcard-qr-setup.html": [
    ["Generate a privacy-first URL QR code", "/posts/2026-10/introducing-matrixqr-url-generator"],
    ["Compare static and dynamic QR codes", "/posts/static-vs-dynamic-qr"],
  ],
};


const ARTICLE_CATEGORY_URLS = {
  "posts/can-you-recommend-a-qr-code-generator-that-allows-customization.html": ["/category/general/", "General QR Code Guides"],
  "posts/2026-10/traditional-menus-digital-menu-qr-code.html": ["/category/digital-menu-branding/", "Digital Menu & Branding"],
  "posts/custom-logo-qr-code-menu-guide.html": ["/category/digital-menu-branding/", "Digital Menu & Branding"],
  "posts/custom-qr-code-generator-logo.html": ["/category/digital-menu-branding/", "Digital Menu & Branding"],
  "posts/how-to-add-logo-to-qr-code-without-breaking-it.html": ["/category/digital-menu-branding/", "Digital Menu & Branding"],
  "posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization.html": ["/category/qr-code-security-privacy/", "QR Code Security & Privacy"],
  "posts/static-vs-dynamic-qr.html": ["/category/general/", "General QR Code Guides"],
  "posts/the-pros-and-cons-of-static-qr-codes.html": ["/category/qr-code-security-privacy/", "QR Code Security & Privacy"],
  "posts/2026-10/introducing-matrixqr-url-generator.html": ["/category/general/", "General QR Code Guides"],
  "posts/vcard-qr-setup.html": ["/category/vcard-contact-management/", "vCard & Contact Management"],
};

function buildRelatedLinks(links, categoryUrl) {
  const category = categoryUrl ? [[`Explore ${categoryUrl[1]}`, categoryUrl[0]]] : [];
  const items = [...links, ...category].map(([label, url]) =>
    `                <li><a href="${url}">${label}</a></li>`
  ).join("\n");

  return `${MARKER}\n<section aria-labelledby="topic-cluster-links" class="mt-10 border-t border-slate-800 pt-8">\n    <h2 id="topic-cluster-links">Related QR Code Guides</h2>\n    <ul>\n${items}\n    </ul>\n</section>`;
}

function normalizeArticleUrl(url) {
  let value = String(url || "").trim().replace(/^https?:\/\/blog\.matrixqr\.cc/i, "");
  value = value.split(/[?#]/, 1)[0];
  if (!value.startsWith("/posts/")) return null;
  value = value.replace(/\/+$/, "").replace(/\.html$/i, "");
  try { return decodeURIComponent(value); } catch { return value; }
}

function getExistingArticleTargets(html) {
  const match = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) throw new Error("Could not find article content for related-link filtering.");
  let content = match[1];
  const markerIndex = content.indexOf(MARKER);
  if (markerIndex !== -1) content = content.slice(0, markerIndex);
  const targets = new Set();
  for (const link of content.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const target = normalizeArticleUrl(link[1]);
    if (target) targets.add(target);
  }
  return targets;
}

function filterAlreadyLinkedTargets(html, links) {
  const existing = getExistingArticleTargets(html);
  return links.filter(([, url]) => !existing.has(normalizeArticleUrl(url)));
}

function injectTopicClusterLinks(html, links, categoryUrl) {
  if (html.includes(MARKER)) return html;
  const closingTag = "</article>";
  const index = html.lastIndexOf(closingTag);
  if (index === -1) throw new Error("Could not find closing </article> tag.");
  const filteredLinks = filterAlreadyLinkedTargets(html, links);
  if (filteredLinks.length === 0 && !categoryUrl) return html;
  const block = buildRelatedLinks(filteredLinks, categoryUrl);
  return `${html.slice(0, index)}\n${block}\n${html.slice(index)}`;
}

function updateArticle(filePath, links) {
  const html = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath).split(path.sep).join('/');
  const updated = injectTopicClusterLinks(html, links, ARTICLE_CATEGORY_URLS[relativePath]);
  if (updated !== html) fs.writeFileSync(filePath, updated, "utf8");
  return updated !== html;
}

if (require.main === module) {
  let updatedCount = 0;
  for (const [relativePath, links] of Object.entries(TOPIC_LINKS)) {
    const filePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(filePath)) throw new Error(`Missing article: ${relativePath}`);
    if (updateArticle(filePath, links)) updatedCount += 1;
  }
  console.log(`[topic-links] Updated ${updatedCount}/${Object.keys(TOPIC_LINKS).length} article(s).`);
}

module.exports = { MARKER, TOPIC_LINKS, ARTICLE_CATEGORY_URLS, buildRelatedLinks, normalizeArticleUrl, getExistingArticleTargets, filterAlreadyLinkedTargets, injectTopicClusterLinks };
