function injectSiteSponsor() {
    if (document.querySelector("[data-site-sponsor]")) return;

    const footer = document.querySelector("footer");
    if (!footer || !footer.parentNode) return;

    const section = document.createElement("section");
    section.className = "w-full px-6 pb-6";
    section.setAttribute("data-site-sponsor", "true");
    section.setAttribute("aria-label", "Sponsor");

    const container = document.createElement("div");
    container.className = "max-w-7xl mx-auto rounded-2xl border border-slate-800/80 bg-[#080d1a]/70 px-5 py-4 sm:px-6";

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

    container.append(link);
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
