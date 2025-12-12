import { handler as fetch } from "../serve.ts";

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

        .submit-btn:hover {

            background: #0056cc;

        }

        .instructions {

            color: #666;

            margin: 20px 0;

            font-size: 15px;

        }

        .example {

            background: #e7f3ff;

            padding: 15px;

            border-radius: 6px;

            margin-top: 25px;

            text-align: left;

        }

        .example h3 {

            margin-top: 0;

            color: #0056cc;

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

    </button>

    

    <div class="instructions">

        <p>按 Enter 键也可以提交</p>

    </div>

    

    <div class="example">

        <h3>📋 使用示例：</h3>

        <p>1. 复制抖音视频链接：<code>https://v.douyin.com/n_r5jmCP31I</code></p>

        <p>2. 粘贴到上方输入框中</p>

        <p>3. 点击"解析下载"按钮</p>

        <p>4. 获取视频信息和下载链接</p>

    </div>

    

    <div id="loadingOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:10px; text-align:center;">
            <div style="font-size:24px; margin-bottom:15px;">⏳</div>
            <div id="loadingText">正在解析视频链接...</div>
        </div>
    </div>

    <script>

        function showLoading(text) {
            document.getElementById('loadingText').textContent = text || '正在解析视频链接...';
            document.getElementById('loadingOverlay').style.display = 'flex';
        }

        function hideLoading() {
            document.getElementById('loadingOverlay').style.display = 'none';
        }

        async function processUrl() {

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

            

            // 显示加载状态
            showLoading('正在解析视频链接...');
            
            try {
                // 获取视频信息
                const encodedUrl = encodeURIComponent(videoUrl);
                const response = await fetch('/?url=' + encodedUrl + '&data=true');
                const data = await response.json();
                
                if (data.type === 'video' && data.video_url) {
                    // 直接下载视频
                    showLoading('正在下载视频...');
                    
                    // 生成文件名
                    const fileName = (data.desc || data.aweme_id || 'douyin_video').replace(/[\\\\/:*?"<>|]/g, '_').substring(0, 50) + '.mp4';
                    
                    // 使用 fetch 下载视频并触发下载
                    try {
                        const videoResponse = await fetch(data.video_url);
                        const blob = await videoResponse.blob();
                        const downloadUrl = window.URL.createObjectURL(blob);
                        
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = downloadUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        
                        // 清理
                        window.URL.revokeObjectURL(downloadUrl);
                        document.body.removeChild(a);
                        
                        hideLoading();
                        alert('视频下载已开始！\\n文件名: ' + fileName);
                    } catch (downloadErr) {
                        // 如果 fetch 下载失败，尝试直接打开链接
                        hideLoading();
                        if (confirm('直接下载失败，是否在新窗口打开视频链接？')) {
                            window.open(data.video_url, '_blank');
                        }
                    }
                } else if (data.type === 'img' && data.image_url_list && data.image_url_list.length > 0) {
                    // 图集类型，逐个下载图片
                    hideLoading();
                    const imgCount = data.image_url_list.length;
                    if (confirm('检测到图集，共 ' + imgCount + ' 张图片，是否下载？')) {
                        showLoading('正在下载图片...');
                        
                        for (let i = 0; i < data.image_url_list.length; i++) {
                            try {
                                showLoading('正在下载第 ' + (i + 1) + '/' + imgCount + ' 张图片...');
                                const imgUrl = data.image_url_list[i];
                                const imgResponse = await fetch(imgUrl);
                                const blob = await imgResponse.blob();
                                const downloadUrl = window.URL.createObjectURL(blob);
                                
                                const baseName = (data.desc || data.aweme_id || 'douyin_img').replace(/[\\\\/:*?"<>|]/g, '_').substring(0, 40);
                                const fileName = baseName + '_' + (i + 1) + '.webp';
                                
                                const a = document.createElement('a');
                                a.style.display = 'none';
                                a.href = downloadUrl;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                
                                window.URL.revokeObjectURL(downloadUrl);
                                document.body.removeChild(a);
                                
                                // 添加小延迟避免浏览器拦截
                                await new Promise(resolve => setTimeout(resolve, 500));
                            } catch (imgErr) {
                                console.error('下载图片失败:', imgErr);
                            }
                        }
                        
                        hideLoading();
                        alert('图片下载完成！共 ' + imgCount + ' 张');
                    }
                } else {
                    hideLoading();
                    alert('未能获取到有效的下载链接，请检查链接是否正确。');
                }
            } catch (err) {
                hideLoading();
                console.error('解析失败:', err);
                alert('解析失败：' + err.message + '\\n请检查链接是否正确。');
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

                });

            }

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

