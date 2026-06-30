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

        <p>将抖音或豆包视频链接粘贴到下方输入框中，然后点击"解析下载"</p>

    </div>

    

    <div class="url-container">

        <input type="text" 

               id="videoUrl" 

               class="url-input" 

               placeholder="在此粘贴抖音或豆包视频链接"

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

        <p>1. 复制抖音或豆包视频链接：<code>https://v.douyin.com/n_r5jmCP31I</code></p>

        <p>2. 粘贴到上方输入框中</p>

        <p>3. 点击"解析下载"按钮</p>

    </div>

    

    <script>

        function processUrl() {

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
