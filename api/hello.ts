import { handler as fetch } from "../serve.ts";

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hasUrlParam = url.searchParams.has('url');

    if (hasUrlParam) {
        return fetch(request);
    }

    // 简单输入界面
    const html = `
    <html><body style="text-align:center;padding:50px">
        <h2>视频下载</h2>
        <p style="font-size:20px;margin:30px 0">
            <code>https://down.aibyai.cn/?url=</code>
        </p>
        <input type="text" 
               id="url" 
               placeholder="粘贴视频链接到这里"
               style="width:500px;padding:10px;font-size:16px"
               autofocus>
        <br><br>
        <button onclick="go()" style="padding:10px 30px;font-size:16px">
            下载
        </button>
        <script>
            function go() {
                const url = document.getElementById('url').value.trim();
                if (url) {
                    window.location.href = '/?url=' + encodeURIComponent(url) + '&data=true';
                }
            }
            document.getElementById('url').addEventListener('keypress', e => {
                if (e.key === 'Enter') go();
            });
        </script>
    </body></html>
    `;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
