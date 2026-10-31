function injectSiteSponsor() {
    if (document.querySelector("[data-site-sponsor]")) return;

    const footer = document.querySelector("footer");
    if (!footer || !footer.parentNode) return;

    const section = document.createElement("section");
    section.className = "w-full px-6 pb-6";
    section.setAttribute("data-site-sponsor", "true");
    section.setAttribute("aria-labelledby", "site-sponsor-heading");

    const container = document.createElement("div");
    container.className = "max-w-7xl mx-auto rounded-2xl border border-slate-800/80 bg-[#080d1a]/70 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3";

    const content = document.createElement("div");
    content.className = "space-y-1";

    const heading = document.createElement("h2");
    heading.id = "site-sponsor-heading";
    heading.className = "text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";
    heading.textContent = "Sponsor";

    const link = document.createElement("a");
    link.href = "https://replikasaatblog.com/";
    link.target = "_blank";
    link.rel = "sponsored noopener noreferrer";
    link.className = "inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors";
    link.append(document.createTextNode("Sponsor "));

    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(arrow);

    content.append(heading, link);
    container.append(content);
    section.append(container);
    footer.parentNode.insertBefore(section, footer);
}

document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Most pages receive server-generated sponsor markup during the build.
    // This fallback covers the protected article without changing its source file.
    injectSiteSponsor();

    console.log("MatrixQR Blog Loaded Successfully.");
});
