import { handler as fetch } from "../serve.ts";
import { getVideoInfo } from "../douyin.ts";

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hasUrlParam = url.searchParams.has('url');
    const isDownload = url.searchParams.has('download');

    // 如果是下载请求，代理下载视频
    if (isDownload && hasUrlParam) {
        const inputUrl = url.searchParams.get('url')!;
        try {
            const videoInfo = await getVideoInfo(inputUrl);
            if (videoInfo.type === 'video' && videoInfo.video_url) {
                // 代理请求视频
                const headers = new Headers();
                headers.set("User-Agent", "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36");
                headers.set("Referer", "https://www.douyin.com/");

                const videoResp = await globalThis.fetch(videoInfo.video_url, {
                    method: "GET",
                    headers,
                    redirect: "follow"
                });

                if (!videoResp.ok) {
                    return new Response(JSON.stringify({ error: "视频获取失败: " + videoResp.status }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json; charset=utf-8' }
                    });
                }

                // 生成文件名
                const fileName = (videoInfo.desc || videoInfo.aweme_id || 'douyin_video')
                    .replace(/[\\/:*?"<>|]/g, '_')
                    .substring(0, 50) + '.mp4';

                // 返回视频流
                return new Response(videoResp.body, {
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                        'Cache-Control': 'no-cache'
                    }
                });
            } else {
                return new Response(JSON.stringify({ error: "未找到视频链接" }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                });
            }
        } catch (err) {
            return new Response(JSON.stringify({ error: "下载失败: " + (err as Error).message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }
    }

    // 如果有url参数，调用原有逻辑
    if (hasUrlParam) {
        return fetch(request);
    }

    // 返回中文输入界面
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
        h1 { color: #333; margin-bottom: 30px; }
        .url-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            border: 2px dashed #dee2e6;
        }
        .url-input {
            font-size: 16px;
            padding: 12px 15px;
            width: 500px;
            max-width: 90%;
            border: 2px solid #0070f3;
            border-radius: 6px;
            margin: 10px 0;
            font-family: monospace;
        }
        .submit-btn {
            font-size: 18px;
            padding: 12px 40px;
            background: #0070f3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin: 20px 0;
            transition: background 0.3s;
        }
        .submit-btn:hover { background: #0056cc; }
        .submit-btn:disabled { background: #999; cursor: not-allowed; }
        .instructions { color: #666; margin: 20px 0; font-size: 15px; }
        .example {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 6px;
            margin-top: 25px;
            text-align: left;
        }
        .example h3 { margin-top: 0; color: #0056cc; }
        .example code {
            background: #f1f1f1;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        #loadingOverlay {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        .loading-box {
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
        }
        .loading-icon { font-size: 24px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>📹 视频下载工具</h1>
    
    <div class="instructions">
        <p>将视频链接粘贴到下方输入框中，然后点击"解析下载"</p>
    </div>
    
    <div class="url-container">
        <input type="text" id="videoUrl" class="url-input" placeholder="在此粘贴您的视频链接" autofocus>
    </div>
    
    <button class="submit-btn" id="submitBtn" onclick="processUrl()">解析下载</button>
    
    <div class="instructions">
        <p>按 Enter 键也可以提交</p>
    </div>
    
    <div class="example">
        <h3>📋 使用示例：</h3>
        <p>1. 复制抖音视频链接：<code>https://v.douyin.com/xxxxx</code></p>
        <p>2. 粘贴到上方输入框中</p>
        <p>3. 点击"解析下载"按钮</p>
        <p>4. 视频将自动开始下载</p>
    </div>
    
    <div id="loadingOverlay">
        <div class="loading-box">
            <div class="loading-icon">⏳</div>
            <div id="loadingText">正在解析下载视频...</div>
        </div>
    </div>

    <script>
        function showLoading(text) {
            document.getElementById('loadingText').textContent = text || '正在解析下载视频...';
            document.getElementById('loadingOverlay').style.display = 'flex';
            document.getElementById('submitBtn').disabled = true;
        }

        function hideLoading() {
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('submitBtn').disabled = false;
        }

        function processUrl() {
            const input = document.getElementById('videoUrl');
            const videoUrl = input.value.trim();
            
            if (!videoUrl) {
                alert('请输入视频链接');
                input.focus();
                return;
            }
            
            // 验证URL格式
            try {
                new URL(videoUrl);
            } catch {
                if (!confirm('链接格式可能不正确，是否继续？')) {
                    input.focus();
                    return;
                }
            }
            
            showLoading('正在解析下载视频，请稍候...');
            
            // 直接触发下载（使用隐藏的iframe或a标签）
            const encodedUrl = encodeURIComponent(videoUrl);
            const downloadUrl = '/?url=' + encodedUrl + '&download=true';
            
            // 创建隐藏的iframe来下载
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = downloadUrl;
            document.body.appendChild(iframe);
            
            // 5秒后隐藏loading（下载应该已经开始）
            setTimeout(() => {
                hideLoading();
                document.body.removeChild(iframe);
            }, 5000);
        }

        // 按回车键提交
        document.getElementById('videoUrl').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') processUrl();
        });

        // 页面加载后自动聚焦
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('videoUrl').focus();
        });
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Language': 'zh-CN'
        }
    });
}
