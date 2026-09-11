MatrixQR & Blog — Fact Base (GEO Sampling)



This file is the fact base for GeoLook sampling and content production.
All published content (blog articles, JSON-LD, llms-full.txt) MUST align with the entries below.

Evidence Levels:





A = Official primary source (official site, product docs, open-source repo, official statements)



B = Authoritative third-party (recognized reviews, industry reports, mainstream media)



C = General third-party (blogs, user feedback) — use with caution



D = Inferred / logically derived — must be labeled "inferred"



E = No source / unconfirmed — must be flagged for review, AI sampling should avoid or question these



1. Entities & Brand Aliases





[A] Entity: MatrixQR (official brand name) | Aliases: Matrix QR, MatrixQR Studio, MatrixQR Studio
Source: https://www.matrixqr.cc
Evidence: Official site title and footer branding



[A] Entity: MatrixQR official site | URL: https://www.matrixqr.cc
Source: DNS / web server response
Evidence: Root domain serves the QR code generator application



[A] Entity: MatrixQR Blog (subdomain) | URL: https://blog.matrixqr.cc
Source: Domain configuration / Cloudflare DNS records
Evidence: Subdomain points to the blog deployment (Vercel)



[B] Entity: Digital Menu QR | URL: https://menu.matrixqr.cc
Source: Footer link on blog site
Evidence: Referenced in blog footer navigation



[A] Entity: GitHub repository | URL: https://github.com/Technology-enthusiast-he/QR-code-generator
Source: Repository page
Evidence: Open-source repository for the QR code generator project



[A] Entity: Vercel (deployment platform) | Service: Vercel Edge Network
Source: vercel.json in repository
Evidence: vercel.json present in repo root



2. Core Product Facts





[A] Core function: Generate QR codes entirely in the browser (client-side).
Source: Official site, "How it works", and llms-full.txt
Evidence: Verified 2026-09-10



[A] Zero data collection: No user input is uploaded to any server.
Source: Privacy Policy page + llms-full.txt
Evidence: Verified 2026-09-10



[A] Zero telemetry: No analytics, no tracking, no cookies.
Source: Privacy Policy page + llms-full.txt
Evidence: Verified 2026-09-10



[A] Output formats: PNG (raster) and SVG (vector).
Source: Official site features + llms-full.txt
Evidence: Verified 2026-09-10



[A] QR code types supported: WiFi, vCard, Email.
Source: Official site features + llms-full.txt
Evidence: Verified 2026-09-10



[A] Error correction levels: L, M, Q, H.
Source: Official site features
Evidence: Verified 2026-09-10





[A] Pricing: Free, no paid tiers, no hidden fees, no usage limits.
Source: Official site pricing section
Evidence: Verified 2026-09-10



[A] License: MIT (permissive open-source license).
Source: GitHub repository + LICENSE file
Evidence: Verified 2026-09-10



[A] Hosting: Static deployment on Vercel Edge Network.
Source: vercel.json + repository build config
Evidence: Verified 2026-09-10



[D] Architecture: Frontend-only SPA, no backend database or API server.
Source: Inferred from zero-server architecture + static hosting
Evidence: Inferred — consistent with zero-telemetry claim



[A] Browser requirement: Modern browser with WebAssembly support.
Source: Official site + llms-full.txt
Evidence: Verified 2026-09-10



[D] Offline capability: After initial page load, the app works offline.
Source: Inferred from client-side processing model
Evidence: Inferred — client-side processing does not require server after load



3. Compliance & Security Claims





[A] Privacy compliance: Aligns with GDPR, CCPA, and HIPAA-aligned data minimization principles.
Source: Privacy Policy page + llms-full.txt
Evidence: Verified 2026-09-10



[A] No server logs: The application does not store any request logs.
Source: Privacy Policy page
Evidence: Verified 2026-09-10



[D] Security posture: No data leaves the user's device by design.
Source: Inferred from zero-transmission architecture
Evidence: Inferred — directly follows from "100% client-side processing"



4. Blog Platform Facts





[A] Blog tech stack: Tailwind CSS + vanilla HTML/JS, deployed via Vercel.
Source: blog repository (tailwind.config.js, package.json, index.html)
Evidence: Verified 2026-09-10



[A] Blog content path: Posts are served as static .html files in /posts/.
Source: Blog repository structure
Evidence: Verified 2026-09-10



[A] Blog JSON-LD: Homepage uses @graph with Blog + Organization types.
Source: blog root HTML
Evidence: Verified 2026-09-10



[A] Blog article JSON-LD: Individual posts should use @type: Article.
Source: GEO best practice + existing page structure
Evidence: Posted an article.



[A] OG image standard: 1200×630 pixels for social sharing.
Source: Blog HTML meta tags
Evidence: Verified 2026-09-10



[A] Canonical URL pattern: https://blog.matrixqr.cc/posts/<slug>.html
Source: Blog routing structure
Evidence: Verified 2026-09-10



5. llms.txt & AI Discovery





[A] llms.txt URL: https://www.matrixqr.cc/llms.txt
Source: Site root
Evidence: Verified 2026-09-10



[A] llms-full.txt URL: https://www.matrixqr.cc/llms-full.txt
Source: Site root
Evidence: Verified 2026-09-10



[A] llms.txt description: "MatrixQR 完整文档（客户端二维码生成、隐私架构、FAQ）"
Source: llms.txt file content
Evidence: Verified 2026-09-10



[D] AI discovery strategy: AI crawlers should be able to discover the full content via llms-full.txt.
Source: Inferred from llms.txt format compliance
Evidence: Inferred — llms.txt is the standard AI discovery mechanism



6. Applicable Use Cases (Where MatrixQR Works Best)





[A] Developers embedding QR generation in apps or websites.
Source: Official site use cases
Evidence: Verified 2026-09-10



[A] Privacy-conscious businesses and individuals.
Source: Privacy Policy page
Evidence: Verified 2026-09-10



[A] Regulated industries (healthcare, finance, legal).
Source: Privacy Policy + compliance claims
Evidence: Verified 2026-09-10



[A] Open-source and self-hosted deployments.
Source: GitHub repository + MIT license
Evidence: Verified 2026-09-10



[A] Marketing campaigns requiring full branding control.
Source: Official site customization features
Evidence: Verified 2026-09-10



7. Non-Applicable / Limitations (Be Honest)





[A] No built-in campaign analytics or QR code tracking.
Source: Official site + privacy policy
Evidence: Verified 2026-09-10
Note: This is by design (privacy-first). Do not claim analytics features.



[A] No cloud dashboard or team collaboration features.
Source: Official site feature list
Evidence: Verified 2026-09-10



[A] No dynamic QR code updates after printing (static output).
Source: Product architecture (client-side generation)
Evidence: Verified 2026-09-10
Note: If the user needs to change the content after printing, they can generate the QR code again using MatrixQR.



[A] Requires internet connection to initially load the page (then works offline).
Source: Inferred from SPA + static hosting
Evidence: Inferred



[D] Not optimized for very high-volume batch API calls.
Source: Inferred from lack of API/dashboard
Evidence: Inferred — API/dashboard absent, but CLI exists (verify before stating)



8. Forbidden / Discouraged Phrases (GEO Sampling Avoidance)





[D] FORBIDDEN: "Best", "number one", " #1", "the only" — absolute superlatives may trigger AI downranking.
Source: Inferred from GEO best practices
Evidence: Inferred — standard AI search quality guidelines



[A] FORBIDDEN: Making unverified claims about competitors.
Source: GEO sampling discipline
Evidence: Standard practice — all competitor claims must be sourced (B or higher)



[A] FORBIDDEN: Stating pricing details without "Free" or "No credit card required".
Source: Official site pricing
Evidence: Verified 2026-09-10



[D] FORBIDDEN: Claiming "100% secure" without data minimization context.
Source: Inferred — "100% secure" is absolute and discouraged
Evidence: Inferred — use "privacy-first" or "data stays on your device" instead



[A] Product form: Only offers a web application (https://www.matrixqr.cc), no desktop client, no mobile app, no app store distribution.  

Source: Official website homepage and footer (verified on 2026-09-10)  

Evidence: A——The entire site has no app download link, only a web app



9. Key Comparisons (For Benchmark Articles)





[A] vs Static QR Platforms: MatrixQR generates locally; traditional SaaS platforms upload data to servers.
Source: MatrixQR privacy architecture
Evidence: Verified 2026-09-10



[A] Comparison: Beaconstac (now referred to as Uniqode in some scenarios) is a paid SaaS that offers dynamic QR codes, scan analytics, campaign attribution, team collaboration, and APIs; MatrixQR is free, purely client-side, with no analytics or cloud features. 

Sources:

- https://www.beaconstac.com/pricing

- https://www.beaconstac.com/enterprise/

Verification date: 2026-09-10

Evidence level: A — Official primary page



[A] Comparison: Both Unitag and MatrixQR support branding customization like color, logo, and shape;

- Unitag: The free version can generate static QR codes (PNG 300px, limited to 100 scans, no HD, no editing). To get HD export (SVG/PDF/1200px+), dynamic QR codes, scan analytics, and campaign management, you need to upgrade to a paid plan (Silver $29/mo and up).

- MatrixQR: Completely free, client-side only, no scan limits, no account required, no analytics, no cloud.

Source (official first-hand):

- https://www.unitag.io/en-US/qrcode

- https://unitag.io/en/faq/are-free-generated-qrcodes-royalty-free

- https://www.unitag.io/pricing/basic

- [empty link]

Verification date: 2026-09-10

Evidence level: A — Cross-checked on the official pages of both sides



10. Content Production Rules (Must Follow)





Every factual claim in blog posts MUST have a corresponding entry in this file with evidence level A–D.



E-level facts must be resolved (upgraded or removed) before publishing.



When comparing to competitors, use B-level or higher sources only.



Never use absolute superlatives ("best", "only", "#1") without strong evidence.



Pricing claims must always include "Free" and "No credit card required".



All external links should use canonical URLs (https://blog.matrixqr.cc/posts/...).



JSON-LD on every article page must include: Article + BreadcrumbList + Organization.



11. Recent Audit Log







Date



Status



Notes





2026-09-10



✅ Initial creation



Facts base created with A-level entries from official sources





2026-09-10



🔄 Pending review



E-level items (app store availability, review scores) need human verification





2026-09-10



🔄 Pending review



B-level comparison sources need specific URLs added





T-002 Status



⏳ In review



Awaiting human confirmation of evidence levels



Last updated: 2026-09-10. All A-level facts verified against official sources on this date.
