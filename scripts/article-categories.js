"use strict";

// Canonical category taxonomy shared by every article-indexing generator.
// Unknown or missing values intentionally fall back to General, but callers
// must report them so taxonomy drift cannot remain silent.
const CATEGORY_NAMES = [
  "QR Code Security & Privacy",
  "Digital Menu & Branding",
  "vCard & Contact Management",
  "General"
];

const ALIASES = {
  "security": "QR Code Security & Privacy",
  "security tech": "QR Code Security & Privacy",
  "privacy": "QR Code Security & Privacy",
  "privacy tech": "QR Code Security & Privacy",
  "client side": "QR Code Security & Privacy",
  "client side privacy": "QR Code Security & Privacy",
  "security & privacy": "QR Code Security & Privacy",
  "qr code security & privacy": "QR Code Security & Privacy",
  "restaurant": "Digital Menu & Branding",
  "digital menu": "Digital Menu & Branding",
  "digital menus": "Digital Menu & Branding",
  "digital menu & restaurant technology": "Digital Menu & Branding",
  "branding": "Digital Menu & Branding",
  "branding guide": "Digital Menu & Branding",
  "custom logo": "Digital Menu & Branding",
  "custom qr": "Digital Menu & Branding",
  "menu": "Digital Menu & Branding",
  "digital menu & branding": "Digital Menu & Branding",
  "vcard": "vCard & Contact Management",
  "vcard & mobile wallet guides": "vCard & Contact Management",
  "vcard & contact management": "vCard & Contact Management",
  "contact": "vCard & Contact Management",
  "contact management": "vCard & Contact Management",
  "general": "General",
  "analysis": "General",
  "tutorial": "General",
  "guide": "General",
  "product update": "General",
  "product updates": "General"
};

function normalizeCategory(value = "") {
  return String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

module.exports = { CATEGORY_NAMES, CATEGORIES: ALIASES, normalizeCategory };
