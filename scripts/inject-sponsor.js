const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);
const PROTECTED_FILE = "posts/image-to-qr-menu-guide.html";
const START_MARKER = "<!-- SITE-SPONSOR-START -->";
const END_MARKER = "<!-- SITE-SPONSOR-END -->";

function buildSponsorMarkup() {
    return [
        START_MARKER,
        '<section class="w-full px-6 pb-6" data-site-sponsor="true" aria-label="Sponsor">',
        '    <div class="max-w-7xl mx-auto rounded-2xl border border-slate-800/80 bg-[#080d1a]/70 px-5 py-4 sm:px-6">',
        '        <a href="https://replikasaatblog.com/" target="_blank" rel="sponsored noopener noreferrer" class="inline-flex items-center gap-3 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors">',
        '            <span aria-hidden="true" class="h-7 w-1 rounded-full bg-cyan-300"></span>',
        '            Sponsor',
        '        </a>',
        '    </div>',
        '</section>',
        END_MARKER
    ].join("\n");
}

function injectSponsor(html) {
    if (html.includes(START_MARKER) || html.includes(END_MARKER)) return html;

    const footerMatch = /<footer\b/i.exec(html);
    if (footerMatch) {
        return html.slice(0, footerMatch.index) + buildSponsorMarkup() + "\n\n    " + html.slice(footerMatch.index);
    }

    const bodyClose = /<\/body\s*>/i.exec(html);
    if (bodyClose) {
        return html.slice(0, bodyClose.index) + buildSponsorMarkup() + "\n" + html.slice(bodyClose.index);
    }

    return html;
}

function walk(root = ROOT) {
    let scanned = 0;
    let changed = 0;

    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }

            if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;

            const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
            if (relativePath === PROTECTED_FILE) continue;

            scanned += 1;
            const source = fs.readFileSync(fullPath, "utf8");
            const updated = injectSponsor(source);

            if (updated !== source) {
                fs.writeFileSync(fullPath, updated, "utf8");
                changed += 1;
            }
        }
    }

    visit(root);
    return { scanned, changed };
}

if (require.main === module) {
    const result = walk();
    console.log("Site-wide sponsor section: updated " + result.changed + " of " + result.scanned + " HTML file(s); protected article source skipped.");
}

module.exports = { buildSponsorMarkup, injectSponsor, walk };
