document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 原有的图标加载逻辑
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("MatrixQR Blog Loaded Successfully.");

    // 2. 连接 Rankdesk API 并渲染文章
    const API_KEY = "rd_live_6365f585c11e23c42f33b211d881d35b8e2946"; // 请确保这是你最新的 Key
    const BASE_URL = "https://app.rankdesk.ai/api/public/v1";

    async function initRankdesk() {
        try {
            const response = await fetch(`${BASE_URL}/posts?limit=10&offset=0`, {
                method: 'GET',
                headers: {
                    'x-api-key': API_KEY
                }
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }

            const posts = await response.json();
            console.log("成功从 Rankdesk 获取博客文章数据:", posts);

            // 3. 渲染文章到网页
            renderBlogPosts(posts);

        } catch (error) {
            console.error("连接 Rankdesk 失败:", error);
        }
    }

    // 文章渲染函数 — 完美匹配现有的 Tailwind CSS 样式
    function renderBlogPosts(posts) {
        const container = document.getElementById('blog-posts-container');
        if (!container) {
            console.warn("警告: 没有找到 id='blog-posts-container' 的容器");
            return;
        }

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="text-slate-400">暂无博客文章。</p>';
            return;
        }

        let htmlContent = '';

        posts.forEach((post, index) => {
            // 第一篇作为 Featured Post（置顶大卡片样式）
            if (index === 0) {
                const dateStr = post.publishedAt || post.createdAt || '';
                const dateObj = dateStr ? new Date(dateStr) : new Date();
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
                const category = post.categories?.[0] || 'Security';
                const excerpt = post.excerpt || post.content?.substring(0, 150) || 'No description available.';
                const slug = post.slug || '';

                htmlContent += `
                    <article class="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all group">
                        <div class="p-6 md:p-8 space-y-4">
                            <div class="flex items-center gap-3 text-xs text-cyan-400 font-semibold">
                                <span class="bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full uppercase">${category}</span>
                                <span>•</span>
                                <time datetime="${dateStr}" class="text-slate-500">${formattedDate}</time>
                            </div>
                            <h2 class="text-2xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                                <a href="/posts/${slug}">${post.title || 'Untitled'}</a>
                            </h2>
                            <p class="text-slate-400 text-sm leading-relaxed">
                                ${excerpt}
                            </p>
                            <div class="pt-2 flex items-center justify-between text-xs text-slate-500">
                                <span>By Matrix Security Team</span>
                            </div>
                        </div>
                    </article>
                `;
            } else {
                // 后续文章使用标准卡片样式
                const dateStr = post.publishedAt || post.createdAt || '';
                const dateObj = dateStr ? new Date(dateStr) : new Date();
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
                const category = post.categories?.[0] || 'Tutorial';
                const excerpt = post.excerpt || post.content?.substring(0, 150) || 'No description available.';
                const slug = post.slug || '';

                htmlContent += `
                    <article class="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all space-y-3">
                        <div class="flex items-center gap-2 text-xs text-slate-400">
                            <span class="text-emerald-400 font-medium">${category}</span>
                            <span>•</span>
                            <time datetime="${dateStr}" class="text-slate-500">${formattedDate}</time>
                        </div>
                        <h3 class="text-xl font-bold text-slate-200 hover:text-cyan-400 transition-colors">
                            <a href="/posts/${slug}">${post.title || 'Untitled'}</a>
                        </h3>
                        <p class="text-slate-400 text-sm leading-relaxed">
                            ${excerpt}
                        </p>
                    </article>
                `;
            }
        });

        container.innerHTML = htmlContent;
        console.log("文章渲染完成，共", posts.length, "篇");
    }

    // 触发执行
    initRankdesk();
});
