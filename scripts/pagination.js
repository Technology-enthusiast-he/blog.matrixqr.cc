window.MatrixPager = ({ currentPage, totalPages, baseUrl }) => {
  const wrap = document.getElementById('pager');
  if (!wrap) return;

  // 不够2页就不渲染翻页条
  if (totalPages < 2) { wrap.innerHTML = ''; return; }

  // 防越界：硬访问 /page/2 但只有1页时，跳回
  if (currentPage > totalPages) {
    window.location.href = baseUrl === '' ? '/' : `${baseUrl}/`;
    return;
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  // 拼URL：page/1 不存在，/ 就是第1页
  const prevUrl = currentPage === 2
    ? (baseUrl === '' ? '/' : `${baseUrl}/`)
    : `${baseUrl}/page/${currentPage - 1}`;
  const nextUrl = `${baseUrl}/page/${currentPage + 1}`;

  const makeLink = (dir) => {
    if (dir === 'prev' && prevDisabled) {
      return `<span class="text-slate-600 px-3 py-1 cursor-not-allowed">← Previous</span>`;
    }
    if (dir === 'next' && nextDisabled) {
      return `<span class="text-slate-600 px-3 py-1 cursor-not-allowed">Next →</span>`;
    }
    const url = dir === 'prev' ? prevUrl : nextUrl;
    const label = dir === 'prev' ? '← Previous' : 'Next →';
    return `<a href="${url}" class="text-slate-300 hover:text-white px-3 py-1 underline-offset-4 hover:underline transition-colors">${label}</a>`;
  };

  wrap.className = 'flex justify-between items-center mt-10 text-sm';
  wrap.innerHTML = `
    ${makeLink('prev')}
    <span class="text-slate-500">Page ${currentPage} / ${totalPages}</span>
    ${makeLink('next')}
  `;
};
