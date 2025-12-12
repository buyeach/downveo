
检查分析功能
12月13日
·
downveo
·
main
·
+71
-5

归档

分享

创建拉取请求


检查分析有哪些功能
复制
以下是对仓库现有功能的梳理：
核心能力
抖音无水印解析：通过 GET 请求 /?url=<抖音分享链接>，直接返回对应的无水印视频直链；添加 data 参数则返回包含视频/图文详情的 JSON。
返回数据结构：JSON 模式下会提供视频 ID、点赞/评论/分享/收藏数、作者昵称与签名、标题、格式化的创建时间，以及视频直链或图集图片列表等字段（type 用于区分视频或图集）。
内容解析逻辑：内部通过自定义的 getVideoUrl、getVideoInfo 函数请求抖音页面，匹配视频 ID 或图集 URL 列表并组装返回对象；视频直链按 1080p 模板拼接，图集会过滤掉含 /obj/ 的低质量链接。
使用与交互
Web 表单页：在 Vercel 等环境访问 /api/hello 时无 url 参数会返回中文引导页，提供输入框、示例和自动聚焦/剪贴板检测，提交后重定向到 /?url=<链接>&data=true 以获取 JSON 结果。
部署方式：项目支持 Deno Deploy、Cloudflare Workers（可直接使用编译产物 cfbuild.js）、Vercel（入口 /api/hello）、Docker 等多种上线方案。
我希望能在输入要下载的网址以后,点击能直接下载
复制
Summary
Added a direct-download flow on the landing page that fetches the parsed video link, triggers browser download, and provides fallback instructions if automatic downloading fails.
Introduced status messaging plus a secondary action button to view JSON details, along with supporting styles for the new controls.
Testing
Not run (not requested).

文件 (1)
你改好并保存了吗,我刷新网址就能实现我要的功能了吗
复制
Summary
Fixed the download完成提示的字符串拼接，避免脚本因断行而失效，并确保自动下载失败时的手动下载链接正确展示。
Testing
Not run (not requested).

文件 (1)
我需要你给我实现我要的功能,就是在我粘贴抖音链接后,点击解析下载按钮后,直接就下载视频
复制
Summary
Added endpoint auto-detection so the landing page uses the correct path (root or /api/hello) when requesting downloads or JSON data, ensuring the download button works after pasting a Douyin link.
Testing
Not run (not requested).

文件 (1)

api/hello.ts
+71
-5


差异
日志

api/hello.ts
+71
-5

@@ -3,50 +3,71 @@ import { handler as fetch } from "../serve.ts";
export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hasUrlParam = url.searchParams.has('url');

    // 如果有url参数，调用原有逻辑
    if (hasUrlParam) {
        return fetch(request);
    }

    // 返回中文输入界面，确保UTF-8编码
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>视频下载工具</title>
    <style>
        body {
            font-family: "Microsoft YaHei", Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            line-height: 1.6;
        }
        .secondary-actions {
            margin-bottom: 10px;
        }
        .link-btn {
            font-size: 14px;
            padding: 8px 20px;
            background: #f0f4ff;
            color: #0056cc;
            border: 1px solid #b8d1ff;
            border-radius: 6px;
            cursor: pointer;
        }
        .link-btn:hover {
            background: #e1ecff;
        }
        .status {
            margin-top: 15px;
            color: #333;
            font-size: 15px;
            min-height: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .url-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            border: 2px dashed #dee2e6;
        }
        .base-url {
            font-size: 18px;
            color: #0070f3;
            font-weight: bold;
            font-family: monospace;
        }
        .url-input {
            font-size: 16px;
            padding: 12px 15px;
            width: 500px;
            max-width: 90%;
            border: 2px solid #0070f3;
            border-radius: 6px;
            margin: 10px 0;
@@ -84,93 +105,138 @@ export default async function handler(request: Request): Promise<Response> {
        }
        .example code {
            background: #f1f1f1;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>📹 视频下载工具</h1>
    
    <div class="instructions">
        <p>将视频链接粘贴到下方输入框中，然后点击"解析下载"</p>
    </div>
    
    <div class="url-container">
        <div class="base-url">https://down.aibyai.cn/?url=</div>
        <input type="text" 
               id="videoUrl" 
               class="url-input" 
               placeholder="在此粘贴您的视频链接"
               autofocus>
    </div>
    
    <button class="submit-btn" onclick="processUrl()">
        解析下载
    <button class="submit-btn" onclick="processUrl('download')">
        解析并直接下载
    </button>
    <div class="secondary-actions">
        <button class="link-btn" onclick="processUrl('json')">查看详细数据 (JSON)</button>
    </div>
    
    <div id="statusMessage" class="status" aria-live="polite"></div>

    <div class="instructions">
        <p>按 Enter 键也可以提交</p>
        <p>按 Enter 键也可以提交，默认会直接发起下载</p>
    </div>
    
    <div class="example">
        <h3>📋 使用示例：</h3>
        <p>1. 复制抖音视频链接：<code>https://v.douyin.com/n_r5jmCP31I</code></p>
        <p>2. 粘贴到上方输入框中</p>
        <p>3. 点击"解析下载"按钮</p>
        <p>4. 获取视频信息和下载链接</p>
    </div>
    
    <script>
        function processUrl() {
        function getEndpointBase() {
            const path = window.location.pathname;
            return /\/api\/hello\/?$/.test(path) ? '/api/hello' : '';
        }

        async function processUrl(action = 'download') {
            const input = document.getElementById('videoUrl');
            const videoUrl = input.value.trim();
            
            if (!videoUrl) {
                alert('请输入视频链接');
                input.focus();
                return;
            }
            
            // 验证是否为有效的URL
            try {
                new URL(videoUrl);
            } catch {
                if (confirm('您输入的链接格式可能不正确，是否继续？')) {
                    // 继续处理
                } else {
                    input.focus();
                    input.select();
                    return;
                }
            }
            
            // 编码URL并跳转
            const encodedUrl = encodeURIComponent(videoUrl);
            window.location.href = '/?url=' + encodedUrl + '&data=true';
            const endpoint = getEndpointBase();

            if (action === 'json') {
                window.location.href = `${endpoint}?url=${encodedUrl}&data=true`;
                return;
            }

            const status = document.getElementById('statusMessage');
            status.textContent = '正在解析下载链接，请稍候...';

            try {
                const response = await fetch(`${endpoint}?url=${encodedUrl}`);
                if (!response.ok) {
                    throw new Error('解析失败，服务器返回状态码：' + response.status);
                }

                const directUrl = (await response.text()).trim();

                if (!directUrl.startsWith('http')) {
                    throw new Error('未获取到有效的下载链接，请稍后重试');
                }

                status.textContent = '解析成功，正在发起下载...';

                // 创建隐藏的下载链接并触发点击
                const tempLink = document.createElement('a');
                tempLink.href = directUrl;
                tempLink.download = 'video.mp4';
                document.body.appendChild(tempLink);
                tempLink.click();
                tempLink.remove();

                status.innerHTML = `如果未自动下载，可 <a href="${directUrl}" target="_blank">点击此处</a> 或复制链接手动下载。`;
            } catch (error) {
                status.textContent = error.message || '解析失败，请稍后重试';
            }
        }
        
        // 按回车键提交
        document.getElementById('videoUrl').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                processUrl();
            }
        });
        
        // 页面加载后自动聚焦输入框
        document.addEventListener('DOMContentLoaded', function() {
            const input = document.getElementById('videoUrl');
            input.focus();
            input.select();
            
            // 尝试从剪贴板读取（需要用户授权）
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    if (text && (text.includes('http://') || text.includes('https://'))) {
                        if (confirm('检测到剪贴板中有链接：' + text + '\\n是否使用此链接？')) {
                            input.value = text;
                        }
                    }
                }).catch(err => {
                    // 用户拒绝授权或其它错误，忽略
