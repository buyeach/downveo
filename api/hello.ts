import { handler as fetch } from "../serve.ts";

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 如果没有url参数，显示当前你的应用界面（它本身就有输入框）
    if (!url.searchParams.has('url')) {
        // 直接返回当前你的应用界面，它已经有输入框了
        // 不需要重定向
        return fetch(request);
    }

    // 有url参数时正常处理
    return fetch(request);
}
