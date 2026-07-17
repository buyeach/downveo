const DOUBAO_ORIGIN = "https://www.doubao.com";
const DOUBAO_GUEST_SESSION_URL = `${DOUBAO_ORIGIN}/chat/`;
const DOUBAO_USER_CONFIG_GET_URL = `${DOUBAO_ORIGIN}/creativity/user_config/get`;
const DOUBAO_USER_CONFIG_SET_URL = `${DOUBAO_ORIGIN}/creativity/user_config/set`;
const DOUBAO_WITHOUT_WATERMARK_URL =
  `${DOUBAO_ORIGIN}/creativity/resource/get_without_watermark`;

const DOUBAO_API_PARAMS: Record<string, string> = {
  version_code: "20800",
  language: "zh-CN",
  device_platform: "web",
  aid: "497858",
  real_aid: "497858",
  pkg_type: "release_version",
  device_id: "7550681679050343936",
  pc_version: "3.27.5",
  region: "",
  sys_region: "",
  samantha_web: "1",
  "use-olympus-account": "1",
};

const DOUBAO_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/138.0.0.0 Safari/537.36";

interface DoubaoVideoItem {
  width: number | null;
  height: number | null;
  definition: string | null;
  duration: number | null;
  codec_type: string | null;
  poster_url: string | null;
  url: string;
  bitrate: number | null;
  source: "doubao_without_watermark";
  watermark_free: true;
}

interface DoubaoVideoInfo {
  platform: "doubao";
  type: "video";
  video_url: string | null;
  video_url_list: string[];
  video_list: DoubaoVideoItem[];
}

interface DoubaoApiResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
}

interface DoubaoWatermarkVideoEntry {
  vid?: string;
  download_url?: string;
  duration?: number;
  video_type?: string;
  video_model?: string | DoubaoVideoModel;
  with_audio?: boolean;
}

interface DoubaoWatermarkResourceData {
  without_watermark?: boolean;
  preview_video?: Record<string, DoubaoWatermarkVideoEntry>;
}

interface DoubaoVideoModelItem {
  definition?: string;
  vwidth?: number;
  vheight?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  real_bitrate?: number;
  codec_type?: string;
  main_url?: string;
}

interface DoubaoVideoModel {
  video_duration?: number;
  poster_url?: string;
  video_list?: Record<string, DoubaoVideoModelItem>;
}

interface DoubaoGuestSession {
  cookie: string;
  webTabId: string;
}

function extractFirstUrl(input: string): string {
  const match = input.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : input;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getQueryVideoIds(inputUrl: string): string[] {
  try {
    const parsedUrl = new URL(inputUrl);
    return unique([
      ...parsedUrl.searchParams.getAll("video_id"),
      ...parsedUrl.searchParams.getAll("vid"),
    ]);
  } catch {
    return [];
  }
}

async function doGet(url: string): Promise<Response> {
  const headers = new Headers();
  headers.set("User-Agent", DOUBAO_USER_AGENT);
  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  );
  headers.set("Accept-Language", "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7");
  headers.set("Referer", `${DOUBAO_ORIGIN}/`);
  return await fetch(url, { method: "GET", headers, redirect: "follow" });
}

async function getDoubaoVideoIds(inputUrl: string): Promise<string[]> {
  const url = extractFirstUrl(inputUrl);
  const queryVideoIds = getQueryVideoIds(url);
  if (queryVideoIds.length > 0) {
    return queryVideoIds;
  }

  if (!url.includes("doubao.com/thread/")) {
    throw new Error("链接中缺少 video_id 参数，请使用豆包视频分享链接或豆包 thread 链接");
  }

  const resp = await doGet(url);
  if (!resp.ok) {
    throw new Error(`豆包页面请求失败: ${resp.status}`);
  }

  const body = await resp.text();
  const patterns = [
    /{\\&quot;vid\\&quot;:\\&quot;(.*?)\\&quot/g,
    /"vid"\s*:\s*"([^"]+)"/g,
    /\\"vid\\"\s*:\s*\\"([^"\\]+)\\"/g,
  ];

  const ids: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      ids.push(match[1]);
    }
  }

  const videoIds = unique(ids);
  if (videoIds.length === 0) {
    throw new Error("未能从豆包链接中解析到视频 ID");
  }

  return videoIds;
}

function buildDoubaoApiUrl(baseUrl: string, webTabId: string): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(DOUBAO_API_PARAMS)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("web_tab_id", webTabId);
  return url.toString();
}

function extractTtwid(setCookie: string | null): string {
  const match = setCookie?.match(/(?:^|[,\s])ttwid=([^;,\s]+)/i);
  return match?.[1] ?? "";
}

async function createGuestSession(): Promise<DoubaoGuestSession> {
  const response = await doGet(DOUBAO_GUEST_SESSION_URL);
  const ttwid = extractTtwid(response.headers.get("set-cookie"));
  await response.body?.cancel().catch(() => {});

  if (!response.ok) {
    throw new Error(`豆包匿名会话初始化失败: ${response.status}`);
  }
  if (!ttwid) {
    throw new Error("豆包匿名会话初始化失败：未收到 ttwid");
  }

  return {
    cookie: `ttwid=${ttwid}`,
    webTabId: crypto.randomUUID(),
  };
}

async function postDoubaoJson<T>(
  baseUrl: string,
  session: DoubaoGuestSession,
  body: unknown,
): Promise<DoubaoApiResponse<T>> {
  const headers = new Headers();
  headers.set("User-Agent", DOUBAO_USER_AGENT);
  headers.set("Accept", "application/json, text/plain, */*");
  headers.set("Accept-Language", "zh-CN,zh;q=0.9");
  headers.set("Content-Type", "application/json");
  headers.set("Origin", DOUBAO_ORIGIN);
  headers.set("Referer", `${DOUBAO_ORIGIN}/`);
  headers.set("Cookie", session.cookie);

  const response = await fetch(buildDoubaoApiUrl(baseUrl, session.webTabId), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`豆包无水印资源请求失败: ${response.status}`);
  }

  const result = await response.json() as DoubaoApiResponse<T>;
  if (result.code !== 0) {
    throw new Error(result.msg || `豆包无水印资源请求失败: ${result.code ?? "未知错误"}`);
  }
  return result;
}

async function enableWatermarkFreeResources(session: DoubaoGuestSession): Promise<void> {
  // 匿名用户首次访问时先初始化配置，再开启官方无水印资源开关。
  await postDoubaoJson(DOUBAO_USER_CONFIG_GET_URL, session, {});
  await postDoubaoJson(DOUBAO_USER_CONFIG_SET_URL, session, {
    config_type: 1,
    config_value: {
      watermark_option: { is_on: true },
    },
  });
}

function isWatermarkFreeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.searchParams.get("lr") === "unwatermarked";
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string | undefined): string {
  if (!value) return "";
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const decoded = atob(padded);
    return isWatermarkFreeUrl(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

function parseVideoModel(value: DoubaoWatermarkVideoEntry["video_model"]): DoubaoVideoModel {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as DoubaoVideoModel : {};
  } catch {
    return {};
  }
}

function pickBestModelItem(model: DoubaoVideoModel): DoubaoVideoModelItem | null {
  const entries = Object.values(model.video_list ?? {});
  let best: { item: DoubaoVideoModelItem; pixels: number; bitrate: number } | null = null;

  for (const item of entries) {
    const width = Number(item.vwidth ?? item.width ?? 0);
    const height = Number(item.vheight ?? item.height ?? 0);
    const bitrate = Number(item.real_bitrate ?? item.bitrate ?? 0);
    const pixels = width * height;
    if (!best || pixels > best.pixels || (pixels === best.pixels && bitrate > best.bitrate)) {
      best = { item, pixels, bitrate };
    }
  }

  return best?.item ?? null;
}

function toVideoItem(
  videoId: string,
  entry: DoubaoWatermarkVideoEntry,
): DoubaoVideoItem {
  const model = parseVideoModel(entry.video_model);
  const meta = pickBestModelItem(model);
  const directUrl = entry.download_url ?? "";
  const nestedUrl = decodeBase64Url(meta?.main_url);
  const url = nestedUrl || (isWatermarkFreeUrl(directUrl) ? directUrl : "");

  if (!url) {
    throw new Error(`豆包只返回了带水印资源，拒绝作为无水印视频输出: ${videoId}`);
  }

  return {
    width: Number(meta?.vwidth ?? meta?.width) || null,
    height: Number(meta?.vheight ?? meta?.height) || null,
    definition: meta?.definition ?? null,
    duration: Number(entry.duration ?? model.video_duration) || null,
    codec_type: meta?.codec_type ?? null,
    poster_url: model.poster_url ?? null,
    url,
    bitrate: Number(meta?.real_bitrate ?? meta?.bitrate) || null,
    source: "doubao_without_watermark",
    watermark_free: true,
  };
}

async function requestWatermarkFreeVideos(videoIds: string[]): Promise<DoubaoVideoItem[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const session = await createGuestSession();
      await enableWatermarkFreeResources(session);
      const result = await postDoubaoJson<DoubaoWatermarkResourceData>(
        DOUBAO_WITHOUT_WATERMARK_URL,
        session,
        { vid: videoIds },
      );

      if (result.data?.without_watermark !== true) {
        throw new Error("豆包未允许当前匿名会话获取无水印资源");
      }

      const previewVideos = result.data.preview_video ?? {};
      const entries = Object.values(previewVideos);
      return videoIds.map((videoId) => {
        const entry = previewVideos[videoId] ?? entries.find((item) => item.vid === videoId);
        if (!entry) {
          throw new Error(`豆包未返回视频的高清无水印资源: ${videoId}`);
        }
        return toVideoItem(videoId, entry);
      });
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "未知错误";
  throw new Error(`未能获取豆包服务器高清无水印资源：${reason}`);
}

async function getVideoInfo(url: string): Promise<DoubaoVideoInfo> {
  const videoIds = await getDoubaoVideoIds(url);
  const videoList = await requestWatermarkFreeVideos(videoIds);
  const videoUrlList = videoList.map((video) => video.url);

  return {
    platform: "doubao",
    type: "video",
    video_url: videoUrlList[0] ?? null,
    video_url_list: videoUrlList,
    video_list: videoList,
  };
}

async function getVideoUrl(url: string): Promise<string> {
  const videoInfo = await getVideoInfo(url);
  if (!videoInfo.video_url) {
    throw new Error("豆包高清无水印视频直链解析失败");
  }
  return videoInfo.video_url;
}

export { getVideoInfo, getVideoUrl };
