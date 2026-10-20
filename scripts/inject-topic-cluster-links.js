const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARKER = "<!-- SEO/GEO Topic Cluster Links -->";

const TOPIC_LINKS = {
  "posts/2026-10/traditional-menus-digital-menu-qr-code.html": [
    ["Convert a menu image into a QR code", "/posts/image-to-qr-menu-guide"],
    ["Add a custom logo to a restaurant QR menu", "/posts/custom-logo-qr-code-menu-guide"],
    ["How MatrixQR secures digital menu QR codes", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
  ],
  "posts/image-to-qr-menu-guide.html": [
    ["Why this digital menu approach works well for restaurants", "/posts/2026-10/traditional-menus-digital-menu-qr-code"],
    ["Customize a restaurant QR menu with a logo", "/posts/custom-logo-qr-code-menu-guide"],
  ],
  "posts/custom-logo-qr-code-menu-guide.html": [
    ["Convert an existing menu image into a QR code", "/posts/image-to-qr-menu-guide"],
    ["How MatrixQR secures digital menu QR codes", "/posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization"],
    ["Why restaurants can offer digital menus alongside paper", "/posts/2026-10/traditional-menus-digital-menu-qr-code"],
  ],
  "posts/how-we-secured-digital-menu-qr-codes-canvas-sanitization.html": [
    ["Create a restaurant QR menu with a custom logo", "/posts/custom-logo-qr-code-menu-guide"],
    ["Why digital menus are useful alongside traditional menus", "/posts/2026-10/traditional-menus-digital-menu-qr-code"],
    ["Compare static and dynamic QR codes", "/posts/static-vs-dynamic-qr"],
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

function buildRelatedLinks(links) {
  const items = links.map(([label, url]) =>
    `                <li><a href="${url}">${label}</a></li>`
  ).join("\n");

  return `${MARKER}\n<section aria-labelledby="topic-cluster-links" class="mt-10 border-t border-slate-800 pt-8">\n    <h2 id="topic-cluster-links">Related QR Code Guides</h2>\n    <ul>\n${items}\n    </ul>\n</section>`;
}

function injectTopicClusterLinks(html, links) {
  if (html.includes(MARKER)) return html;

  const closingTag = "</article>";
  const index = html.lastIndexOf(closingTag);
  if (index === -1) throw new Error("Could not find closing </article> tag.");

  const block = buildRelatedLinks(links);
  return `${html.slice(0, index)}\n${block}\n${html.slice(index)}`;
}

function updateArticle(filePath, links) {
  const html = fs.readFileSync(filePath, "utf8");
  const updated = injectTopicClusterLinks(html, links);
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

module.exports = { MARKER, TOPIC_LINKS, buildRelatedLinks, injectTopicClusterLinks };
