const DOUYIN_PLAY_URL =
  "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
const DEFAULT_DOUYIN_RESOLVER_URL =
  "https://api.xingzhige.com/API/douyin/";
const DOUYIN_REQUEST_TIMEOUT_MS = 15_000;

const playIdPattern = /"video":{"play_addr":{"uri":"([a-z0-9]+)"/;
const statsRegex = /"statistics"\s*:\s*\{([\s\S]*?)\},/;
const authorRegex = /"nickname":\s*"([^"]+)",\s*"signature":\s*"([^"]+)"/;
const createTimeRegex = /"create_time":\s*(\d+)/;
const descRegex = /"desc":\s*"([^"]+)"/;

const DOUYIN_PAGE_HOSTS = ["douyin.com", "iesdouyin.com"];
const DOUYIN_MEDIA_HOSTS = [
  "douyinvod.com",
  "douyin.com",
  "amemv.com",
  "pstatp.com",
  "bytecdn.cn",
  "bytecdn.com",
  "snssdk.com",
];

interface DouyinVideoInfo {
  aweme_id: string | null;
  comment_count: number | null;
  digg_count: number | null;
  share_count: number | null;
  collect_count: number | null;
  nickname: string | null;
  signature: string | null;
  desc: string | null;
  create_time: string | null;
  video_url: string | null;
  type: string | null;
  image_url_list: string[] | null;
}

interface DouyinResolverPayload {
  code?: number;
  msg?: string;
  data?: {
    jx?: {
      item_id?: string;
      type?: string;
    };
    author?: {
      name?: string;
      signature?: string;
    };
    stat?: {
      aweme_id?: string;
      comment?: number;
      like?: number;
      share?: number;
      collect?: number;
      time?: number;
    };
    item?: Record<string, unknown> & {
      title?: string;
      url?: string;
      ury?: string;
      size?: number;
      size_y?: number;
      bitrate?: string | number;
    };
  };
}

interface VideoCandidate {
  url: string;
  size: number;
  bitrate: number;
  priority: number;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function extractFirstUrl(input: string): string {
  const match = input.match(/https?:\/\/[^\s]+/i);
  return (match?.[0] ?? input).replace(/[)\]}>，。；、!?]+$/g, "");
}

function hostMatches(hostname: string, allowed: string[]): boolean {
  const normalized = hostname.toLowerCase();
  return allowed.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function ensureDouyinPageUrl(input: string): string {
  const value = extractFirstUrl(input);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("无效的抖音链接");
  }

  if (url.protocol !== "https:" || !hostMatches(url.hostname, DOUYIN_PAGE_HOSTS)) {
    throw new Error("仅支持 douyin.com 或 iesdouyin.com 的抖音链接");
  }
  return url.toString();
}

function isAllowedVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hostMatches(url.hostname, DOUYIN_MEDIA_HOSTS);
  } catch {
    return false;
  }
}

function getEnvironmentValue(name: string): string {
  try {
    const runtime = globalThis as typeof globalThis & {
      Deno?: { env?: { get?: (key: string) => string | undefined } };
    };
    return runtime.Deno?.env?.get?.(name) ?? "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOUYIN_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDouyinPage(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`抖音页面请求失败: ${response.status}`);
  }
  return await response.text();
}

function parseImageList(body: string): string[] {
  const content = body.replace(/\\u002F/g, "/");
  const imagePattern = /{"uri":"[^\s"]+","url_list":\["(https:\/\/p\d{1,2}-sign\.douyinpic\.com\/.*?)"/g;
  const uriPattern = /"uri":"([^\s"]+)","url_list":/g;
  const firstUrls: string[] = [];
  const uris = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(content)) !== null) firstUrls.push(match[1]);
  while ((match = uriPattern.exec(content)) !== null) uris.add(match[1]);

  return [...uris]
    .map((uri) => firstUrls.find((url) => url.includes(uri)))
    .filter((url): url is string => Boolean(url) && !url!.includes("/obj/"));
}

function parseLegacyPage(body: string): DouyinVideoInfo | null {
  const statsMatch = body.match(statsRegex);
  if (!statsMatch) return null;

  const playId = body.match(playIdPattern)?.[1] ?? "";
  const type = playId ? "video" : "img";
  const innerContent = statsMatch[0];
  const numberValue = (pattern: RegExp): number | null => {
    const value = innerContent.match(pattern)?.[1];
    return value ? Number.parseInt(value, 10) : null;
  };
  const author = body.match(authorRegex);
  const createTime = body.match(createTimeRegex)?.[1];

  return {
    aweme_id: innerContent.match(/"aweme_id"\s*:\s*"([^"]+)"/)?.[1] ?? null,
    comment_count: numberValue(/"comment_count"\s*:\s*(\d+)/),
    digg_count: numberValue(/"digg_count"\s*:\s*(\d+)/),
    share_count: numberValue(/"share_count"\s*:\s*(\d+)/),
    collect_count: numberValue(/"collect_count"\s*:\s*(\d+)/),
    nickname: author?.[1] ?? null,
    signature: author?.[2] ?? null,
    desc: body.match(descRegex)?.[1] ?? null,
    create_time: createTime ? formatDate(new Date(Number.parseInt(createTime, 10) * 1000)) : null,
    video_url: playId ? DOUYIN_PLAY_URL.replace("%s", playId) : null,
    type,
    image_url_list: type === "img" ? parseImageList(body) : [],
  };
}

function numericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickBestResolverVideo(item: Record<string, unknown>): string {
  const specifications = [
    { key: "url", sizeKey: "size", priority: 60 },
    { key: "ury", sizeKey: "size_y", priority: 50 },
    { key: "video_url", sizeKey: "size", priority: 40 },
    { key: "videoUrl", sizeKey: "size", priority: 40 },
    { key: "play_url", sizeKey: "size", priority: 30 },
    { key: "playUrl", sizeKey: "size", priority: 30 },
    { key: "play", sizeKey: "size", priority: 20 },
  ];
  const candidates: VideoCandidate[] = [];

  for (const specification of specifications) {
    const value = item[specification.key];
    if (typeof value !== "string" || !isAllowedVideoUrl(value)) continue;
    candidates.push({
      url: value,
      size: numericValue(item[specification.sizeKey]),
      bitrate: numericValue(item.bitrate),
      priority: specification.priority,
    });
  }

  // item.url 是解析服务标记的主播放流；ury 只是兼容码流，不能因文件更大就覆盖主流。
  candidates.sort((left, right) =>
    right.priority - left.priority || right.size - left.size || right.bitrate - left.bitrate
  );
  return candidates[0]?.url ?? "";
}

async function resolveWithFallback(inputUrl: string): Promise<DouyinVideoInfo> {
  const resolverBase = getEnvironmentValue("DOUYIN_RESOLVER_URL") || DEFAULT_DOUYIN_RESOLVER_URL;
  const resolverUrl = new URL(resolverBase);
  resolverUrl.searchParams.set("url", inputUrl);

  const response = await fetchWithTimeout(resolverUrl.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`抖音备用解析服务请求失败: ${response.status}`);
  }

  const payload = await response.json() as DouyinResolverPayload;
  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || "抖音备用解析服务未返回作品数据");
  }

  const item = payload.data.item ?? {};
  const videoUrl = pickBestResolverVideo(item);
  if (!videoUrl) {
    throw new Error("抖音解析成功，但没有返回可验证的官方视频地址");
  }

  const timestamp = numericValue(payload.data.stat?.time);
  return {
    aweme_id: payload.data.stat?.aweme_id ?? payload.data.jx?.item_id ?? null,
    comment_count: numericValue(payload.data.stat?.comment) || null,
    digg_count: numericValue(payload.data.stat?.like) || null,
    share_count: numericValue(payload.data.stat?.share) || null,
    collect_count: numericValue(payload.data.stat?.collect) || null,
    nickname: payload.data.author?.name ?? null,
    signature: payload.data.author?.signature ?? null,
    desc: typeof item.title === "string" ? item.title : null,
    create_time: timestamp ? formatDate(new Date(timestamp * 1000)) : null,
    video_url: videoUrl,
    type: "video",
    image_url_list: [],
  };
}

async function getVideoInfo(input: string): Promise<DouyinVideoInfo> {
  const url = ensureDouyinPageUrl(input);
  try {
    const legacy = parseLegacyPage(await fetchDouyinPage(url));
    if (legacy?.video_url || (legacy?.image_url_list?.length ?? 0) > 0) return legacy;
  } catch {
    // 分享页被风控、失效或结构变化时，继续使用备用解析流程。
  }

  return await resolveWithFallback(url);
}

async function getVideoUrl(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  if (!info.video_url) {
    throw new Error("该抖音链接没有可下载的视频资源");
  }
  return info.video_url;
}

export { getVideoInfo, getVideoUrl };
