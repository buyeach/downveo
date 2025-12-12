import { handler as fetch } from "../serve.ts";

export default async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' && !url.searchParams.has('url')) {
        const exampleUrl = 'https://v.douyin.com/n_r5jmCP31I';
        const redirectUrl = `https://down.aibyai.cn/?url=${encodeURIComponent(exampleUrl)}&data=true`;
        return Response.redirect(redirectUrl, 302);
    }

    return fetch(request);
}
