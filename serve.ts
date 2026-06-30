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

const handler = async (req:Request) => {
    console.log("Method:", req.method);

    const url = new URL(req.url);
    if (url.searchParams.has("url")) {
        const inputUrl = url.searchParams.get("url")!;
        console.log("inputUrl:", inputUrl);
        // 返回完成json数据
        if (url.searchParams.has("data")) {
            const videoInfo = isDoubaoUrl(inputUrl)
                ? await getDoubaoVideoInfo(inputUrl)
                : await getDouyinVideoInfo(inputUrl);
            return new Response(JSON.stringify(videoInfo));
        }
        const videoUrl = isDoubaoUrl(inputUrl)
            ? await getDoubaoVideoUrl(inputUrl)
            : await getDouyinVideoUrl(inputUrl);
        return new Response(videoUrl);
    } else {
        return new Response("请提供url参数");
    }
}

export {handler}
