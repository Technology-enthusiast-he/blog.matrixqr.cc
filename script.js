document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 原有的图标加载逻辑
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("MatrixQR Blog Loaded Successfully.");

    // 2. 新增：连接 Rankdesk API
    // 注意：浏览器端的 JS 无法直接读取 GitHub 的 .env.local 文件
    // 因此，请直接将你的 API Key 粘贴在下方引号中
    const API_KEY = "rd_live_6365f585c11e23c42f33b211d881d35b8e2946"; 
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
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const posts = await response.json();
            console.log("成功从 Rankdesk 获取博客文章:", posts);
            
            // 【重要】
            // Rankdesk 返回数据后，你需要在这里写代码，
            // 把 posts 数组里的内容（标题、正文等）动态添加到你的 index.html 页面上去。
            // 例如：renderBlogPosts(posts); 

        } catch (error) {
            console.error("连接 Rankdesk 失败:", error);
        }
    }

    // 3. 执行初始化函数，触发第一次 API 请求
    initRankdesk();
});
