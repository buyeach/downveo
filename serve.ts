import {
    getVideoInfo as getDoubaoVideoInfo,
    getVideoUrl as getDoubaoVideoUrl,
} from "./doubao.ts";
import {
    getVideoInfo as getDouyinVideoInfo,
    getVideoUrl as getDouyinVideoUrl,
} from "./douyin.ts";

function isDoubaoUrl(inputUrl: string): boolean {
    return inputUrl.includes("doubao.com");
}

function errorResponse(error: unknown, dataMode: boolean): Response {
    const message = error instanceof Error ? error.message : String(error);
    const help = message.includes("未能从豆包链接中解析到视频 ID")
        ? "这个豆包 thread 里没有公开可解析的视频 ID，可能是图片/文字对话、内容未公开，或需要登录后才能看到视频。请使用包含 video_id 的豆包视频分享链接，或确认 thread 中有公开视频。"
        : "解析失败，请检查链接是否有效。";
    const status = 400;

    if (dataMode) {
        return new Response(JSON.stringify({ error: message, help }), {
            status,
            headers: { "Content-Type": "application/json; charset=utf-8" },
        });
    }

    return new Response(`${message}\n${help}`, {
        status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

const handler = async (req:Request) => {
    console.log("Method:", req.method);

    const url = new URL(req.url);
    if (url.searchParams.has("url")) {
        const inputUrl = url.searchParams.get("url")!;
        console.log("inputUrl:", inputUrl);
        const dataMode = url.searchParams.has("data");
        try {
            // 返回完成json数据
            if (dataMode) {
                const videoInfo = isDoubaoUrl(inputUrl)
                    ? await getDoubaoVideoInfo(inputUrl)
                    : await getDouyinVideoInfo(inputUrl);
                return new Response(JSON.stringify(videoInfo));
            }
            const videoUrl = isDoubaoUrl(inputUrl)
                ? await getDoubaoVideoUrl(inputUrl)
                : await getDouyinVideoUrl(inputUrl);
            return new Response(videoUrl);
        } catch (error) {
            console.error(error);
            return errorResponse(error, dataMode);
        }
    } else {
        return new Response("请提供url参数");
    }
}

export {handler}
