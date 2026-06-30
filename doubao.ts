const DOUBAO_PLAY_INFO_URL = "https://www.doubao.com/samantha/media/get_play_info";

const DOUBAO_PLAY_INFO_PARAMS: Record<string, string> = {
  version_code: "20800",
  language: "zh-CN",
  device_platform: "web",
  aid: "497858",
  real_aid: "497858",
  pkg_type: "release_version",
  device_id: "",
  pc_version: "2.51.7",
  region: "",
  sys_region: "",
  samantha_web: "1",
  "use-olympus-account": "1",
  web_tab_id: "",
};

interface DoubaoVideoItem {
  width: number | null;
  height: number | null;
  definition: string | null;
  duration: number | null;
  codec_type: string | null;
  poster_url: string | null;
  url: string;
}

interface DoubaoVideoInfo {
  platform: "doubao";
  type: "video";
  video_url: string | null;
  video_url_list: string[];
  video_list: DoubaoVideoItem[];
}

interface DoubaoPlayInfoResponse {
  data?: {
    poster_url?: string;
    original_media_info?: {
      main_url?: string;
      meta?: {
        width?: number;
        height?: number;
        definition?: string;
        duration?: number;
        codec_type?: string;
      };
    };
  };
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
    return unique(parsedUrl.searchParams.getAll("video_id"));
  } catch {
    return [];
  }
}

async function doGet(url: string): Promise<Response> {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
  );
  headers.set("Accept-Language", "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6");
  return await fetch(url, { method: "GET", headers });
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

async function getDoubaoPlayInfo(videoId: string): Promise<DoubaoVideoItem> {
  const apiUrl = new URL(DOUBAO_PLAY_INFO_URL);
  for (const [key, value] of Object.entries(DOUBAO_PLAY_INFO_PARAMS)) {
    apiUrl.searchParams.set(key, value);
  }

  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/14315 Flue",
  );
  headers.set("Origin", "https://www.doubao.com");
  headers.set("Content-Type", "application/json");

  const resp = await fetch(apiUrl.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({ key: videoId }),
  });

  if (!resp.ok) {
    throw new Error(`豆包播放信息请求失败: ${resp.status}`);
  }

  const result = await resp.json() as DoubaoPlayInfoResponse;
  const originalMediaInfo = result.data?.original_media_info;
  const mainUrl = originalMediaInfo?.main_url;
  if (!mainUrl) {
    throw new Error("豆包 API 返回数据格式异常，可能链接已失效");
  }

  const meta = originalMediaInfo.meta ?? {};
  return {
    width: meta.width ?? null,
    height: meta.height ?? null,
    definition: meta.definition ?? null,
    duration: meta.duration ?? null,
    codec_type: meta.codec_type ?? null,
    poster_url: result.data?.poster_url ?? null,
    url: mainUrl,
  };
}

async function getVideoInfo(url: string): Promise<DoubaoVideoInfo> {
  const videoIds = await getDoubaoVideoIds(url);
  const videoList = await Promise.all(videoIds.map((videoId) => getDoubaoPlayInfo(videoId)));
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
    throw new Error("豆包视频直链解析失败");
  }
  return videoInfo.video_url;
}

export { getVideoInfo, getVideoUrl };
