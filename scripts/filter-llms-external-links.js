const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = [path.join(ROOT, "llms.txt"), path.join(ROOT, "llms-full.txt")];
const ALLOWED_HOSTS = new Set([
  "blog.matrixqr.cc",
  "www.matrixqr.cc",
  "matrixqr.cc",
  "menu.matrixqr.cc",
]);

function isFirstPartyUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function filterMarkdownLinks(text) {
  let output = "";
  let i = 0;
  let removed = 0;

  while (i < text.length) {
    const image = text.startsWith("![", i);
    const link = text[i] === "[";
    if (!image && !link) {
      output += text[i++];
      continue;
    }

    const labelStart = i + (image ? 2 : 1);
    const labelEnd = text.indexOf("](", labelStart);
    if (labelEnd < 0) {
      output += text[i++];
      continue;
    }

    const destinationStart = labelEnd + 2;
    let j = destinationStart;
    let depth = 0;
    let escaped = false;
    let closed = false;

    for (; j < text.length; j++) {
      const ch = text[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "(") {
        depth++;
        continue;
      }
      if (ch === ")") {
        if (depth === 0) {
          closed = true;
          break;
        }
        depth--;
      }
      if (/\s/.test(ch) && depth === 0) break;
    }

    if (!closed) {
      output += text[i++];
      continue;
    }

    const rawUrl = text.slice(destinationStart, j)
      .replace(/\\([()])/g, "$1")
      .trim();
    const label = text.slice(labelStart, labelEnd);

    if (isFirstPartyUrl(rawUrl)) {
      output += text.slice(i, j + 1);
    } else if (/^https?:\/\//i.test(rawUrl)) {
      output += image ? label : label;
      removed++;
    } else {
      output += text.slice(i, j + 1);
    }

    i = j + 1;
  }

  return { text: output, removed };
}

function stripTrailingUrlPunctuation(url) {
  let value = url;
  let trailing = "";
  while (/[.,!?;:]$/.test(value)) {
    trailing = value.slice(-1) + trailing;
    value = value.slice(0, -1);
  }
  while (value.endsWith(")")) {
    const opens = (value.match(/\(/g) || []).length;
    const closes = (value.match(/\)/g) || []).length;
    if (closes <= opens) break;
    trailing = ")" + trailing;
    value = value.slice(0, -1);
  }
  return { url: value, trailing };
}

function filterBareExternalUrls(text) {
  const urlPattern = /https?:\/\/[^\s<>'"`\]\}]+/gi;
  let removed = 0;
  const output = text.replace(urlPattern, (candidate) => {
    const { url, trailing } = stripTrailingUrlPunctuation(candidate);
    if (isFirstPartyUrl(url)) return candidate;
    removed++;
    return trailing;
  });
  return { text: output, removed };
}

function filterExternalUrls(text) {
  const links = filterMarkdownLinks(text);
  const bare = filterBareExternalUrls(links.text);
  return {
    text: bare.text,
    removed: links.removed + bare.removed,
  };
}

function filterFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const result = filterExternalUrls(source);
  if (result.text !== source) {
    fs.writeFileSync(file, result.text.endsWith("\n") ? result.text : result.text + "\n", "utf8");
  }
  return result.removed;
}

if (require.main === module) {
  let removed = 0;
  for (const file of FILES) {
    if (!fs.existsSync(file)) throw new Error(`LLM file not found: ${file}`);
    removed += filterFile(file);
  }
  console.log(`[llms] Removed ${removed} third-party URL(s); first-party MatrixQR URLs were preserved.`);
}

module.exports = {
  ALLOWED_HOSTS,
  filterBareExternalUrls,
  filterExternalUrls,
  filterMarkdownLinks,
  isFirstPartyUrl,
};
