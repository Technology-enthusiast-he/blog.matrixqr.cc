const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const TARGET = /(<a\b[^>]*href=["']\/sitemap\/["'][^>]*>)([\s\S]*?)(<\/a>)/gi;

let changed = 0;
let scanned = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    scanned += 1;

    const source = fs.readFileSync(fullPath, 'utf8');
    const updated = source.replace(TARGET, (match, open, label, close) => {
      if (!/All Articles/i.test(label)) return match;
      changed += 1;
      return `${open}Sitemap${close}`;
    });

    if (updated !== source) {
      fs.writeFileSync(fullPath, updated);
    }
  }
}

walk(ROOT);
console.log(`Footer sitemap label normalized: ${changed} link(s) across ${scanned} HTML file(s).`);
