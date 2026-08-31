document.addEventListener('DOMContentLoaded', () => {
    // 1. 加载图标
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("MatrixQR Blog Loaded Successfully.");

    // 2. 你的 Rankdesk 密钥
    const API_KEY = "rd_live_6365f585c11e23c42f33b211d881d35b8e2946"; 
    // 拼接完整的请求 URL，确保包含 apiKey 参数
    const FETCH_URL = `https://app.rankdesk.ai/api/public/v1/posts?apiKey=${API_KEY}&limit=10&offset=0`;

    async function initRankdesk() {
        try {
            // 发起网络请求
            const response = await fetch(FETCH_URL);
            
            // 检查服务器返回状态码
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }

            const posts = await response.json();
            console.log("成功从 Rankdesk 获取博客文章:", posts);

            // 获取页面上的文章容器
            const container = document.getElementById('blog-posts-container');
            if (!container) return; // 如果没找到容器就停止运行

            // 清空容器，防止重复添加
            container.innerHTML = ''; 

            // 遍历获取到的文章，并套用你的 HTML 结构进行渲染
            posts.forEach(
