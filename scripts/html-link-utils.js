"use strict";

function decodeEntities(value = "") {
    return String(value)
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function getAttributes(tag) {
    const attributes = {};
    const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    for (const match of tag.matchAll(pattern)) {
        attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attributes;
}

function getLinksByRel(html, rel) {
    const expected = String(rel).toLowerCase();
    const results = [];
    for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
        const attributes = getAttributes(match[0]);
        const relTokens = String(attributes.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
        if (relTokens.includes(expected) && attributes.href) results.push(attributes.href.trim());
    }
    return results;
}

function getLinkByRel(html, rel) {
    return getLinksByRel(html, rel)[0] || "";
}

module.exports = { getAttributes, getLinksByRel, getLinkByRel };
