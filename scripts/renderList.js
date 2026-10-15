window.MatrixBlog = (() => {
  const PER_PAGE = 6;

  async function loadPosts() {
    // 带版本戳防Vercel缓存旧JSON
    const r = await fetch(`/posts.json?v=${Date.now()}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error('posts.json not found');
    return r.json();
  }

  function sortDesc(posts) {
    return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function paginate(posts, pageNum) {
    const sorted = sortDesc(posts);
    const start = (pageNum - 1) * PER_PAGE;
    return {
      items: sorted.slice(start, start + PER_PAGE),
      totalPages: Math.max(1, Math.ceil(sorted.length / PER_PAGE)),
      total: sorted.length
    };
  }

  /* ===== 首页卡片模板（和你现有Tailwind完全对齐）===== */
  function cardHTML(p) {
    const prettyDate = new Date(p.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit'
    });
    return `
      <article class="mb-8 p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-colors">
        <div class="flex items-center gap-3 text-xs text-slate-400 mb-2">
          <span class="uppercase tracking-wider">${p.category || 'General'}</span>
          <span>•</span>
          <time>${prettyDate}</time>
        </div>
        <h2 class="text-xl font-semibold text-slate-100 mb-3">
          <a href="${p.htmlFile}" class="hover:text-white underline-offset-4 hover:underline">${p.title}</a>
        </h2>
        <p class="text-slate-300 leading-relaxed text-sm mb-4">${p.excerpt || ''}</p>
        <div class="flex flex-wrap gap-2">
          ${(p.tags || []).map(t => `<span class="text-xs text-slate-500">#${t}</span>`).join('')}
        </div>
      </article>
    `;
  }

  /* ===== 归档页纯列表行（/posts/ 用）===== */
  function archiveRowHTML(p) {
    const ymd = (p.date || '').split('T')[0]; // 2026-10-15
    return `
      <li class="flex justify-between items-baseline py-3 border-b border-slate-700/60">
        <a href="${p.htmlFile}" class="text-slate-300 hover:text-white underline-offset-4 hover:underline">${p.title}</a>
        <span class="text-xs text-slate-500 whitespace-nowrap ml-4">${ymd}</span>
      </li>
    `;
  }

  return { loadPosts, paginate, cardHTML, archiveRowHTML };
})();
