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

    // 获取页面上用来显示文章的容器
    const container = document.getElementById('blog-posts-container');

    // 在容器里显示“正在加载...”的提示
    if (container) {
        container.innerHTML = '<p class="text-slate-400 text-sm">正在加载文章...</p>';
    }

    async function initRankdesk() {
        // 如果找不到容器，就不执行后续操作
        if (!container) return;

        try {
            // 发起网络请求
            const response = await fetch(FETCH_URL);

            // 检查请求是否成功 (比如不是401或404错误)
            if (!response.ok) {
                throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
            }

            // 解析返回的 JSON 数据
            const data = await response.json();
            
            // 清空“正在加载...”的提示
            container.innerHTML = '';

            // 检查数据是否是数组
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    container.innerHTML = '<p class="text-slate-400 text-sm">没有找到文章。</p>';
                    return;
                }
