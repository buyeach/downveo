const DOUYIN_PLAY_URL =
  "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
const DEFAULT_DOUYIN_RESOLVER_URL =
  "https://api.xingzhige.com/API/douyin/";
const DOUYIN_REQUEST_TIMEOUT_MS = 15_000;
const DOUYIN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/90.0.4430.212 Safari/537.36";
const DOUYIN_DETAIL_URL = "https://www.douyin.com/aweme/v1/web/aweme/detail/";
const DOUYIN_HOME_URL = "https://www.douyin.com/";
const TTVID_REGISTER_URL = "https://ttwid.bytedance.com/ttwid/union/register/";

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
const DOUYIN_IMAGE_HOSTS = ["douyinpic.com", "pstatp.com", "byteimg.com"];

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

interface DouyinPageResult {
  body: string;
  finalUrl: string;
}

interface OfficialPlayAddress {
  data_size?: number;
  height?: number;
  width?: number;
  url_list?: string[];
}

interface OfficialBitRate {
  bit_rate?: number;
  is_h265?: number;
  play_addr?: OfficialPlayAddress;
}

interface OfficialVideo {
  bit_rate?: OfficialBitRate[];
  play_addr?: OfficialPlayAddress;
}

interface OfficialAwemeDetail {
  aweme_id?: string;
  create_time?: number;
  desc?: string;
  duration?: number;
  images?: Array<{ url_list?: string[] }>;
  statistics?: {
    collect_count?: number;
    comment_count?: number;
    digg_count?: number;
    share_count?: number;
  };
  author?: {
    nickname?: string;
    signature?: string;
  };
  video?: OfficialVideo;
}

interface OfficialDetailPayload {
  aweme_detail?: OfficialAwemeDetail;
  status_code?: number;
  status_msg?: string;
}

interface OfficialVideoCandidate {
  bitrate: number;
  height: number;
  isH265: boolean;
  size: number;
  url: string;
  width: number;
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

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hostMatches(url.hostname, DOUYIN_IMAGE_HOSTS);
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

async function fetchDouyinPage(url: string): Promise<DouyinPageResult> {
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "User-Agent":
        DOUYIN_USER_AGENT,
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    redirect: "follow",
  });
  if (!response.ok && !extractAwemeId(response.url)) {
    throw new Error(`抖音页面请求失败: ${response.status}`);
  }
  return {
    body: await response.text(),
    finalUrl: response.url,
  };
}

function extractAwemeId(value: string): string {
  return value.match(/\/(?:video|note)\/(\d{10,})/i)?.[1]
    ?? value.match(/"aweme_id"\s*:\s*"(\d{10,})"/)?.[1]
    ?? "";
}

function getResponseCookie(response: Response, name: string): string {
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = cookieHeaders.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const pattern = new RegExp(`(?:^|[,;]\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;,\\s]+)`);
  for (const value of values) {
    const match = value.match(pattern);
    if (match) return `${name}=${match[1]}`;
  }
  return "";
}

function generateUifid(): string {
  const bytes = new Uint8Array(80);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function rotateLeft(value: number, bits: number): number {
  const shift = bits % 32;
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function sm3(input: Uint8Array): number[] {
  const initial = [
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
    0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
  ];
  const bitLength = BigInt(input.length) * 8n;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[input.length] = 0x80;
  const view = new DataView(message.buffer);
  view.setBigUint64(paddedLength - 8, bitLength, false);

  const state = initial.slice();
  const words = new Uint32Array(68);
  const derived = new Uint32Array(64);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 68; index++) {
      const value = words[index - 16] ^ words[index - 9] ^ rotateLeft(words[index - 3], 15);
      words[index] = (
        value ^ rotateLeft(value, 15) ^ rotateLeft(value, 23) ^
        rotateLeft(words[index - 13], 7) ^ words[index - 6]
      ) >>> 0;
    }
    for (let index = 0; index < 64; index++) {
      derived[index] = (words[index] ^ words[index + 4]) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const constant = index < 16 ? 0x79cc4519 : 0x7a879d8a;
      const a12 = rotateLeft(a, 12);
      const ss1 = rotateLeft((a12 + e + rotateLeft(constant, index)) >>> 0, 7);
      const ss2 = (ss1 ^ a12) >>> 0;
      const ff = index < 16 ? (a ^ b ^ c) : ((a & b) | (a & c) | (b & c));
      const gg = index < 16 ? (e ^ f ^ g) : ((e & f) | (~e & g));
      const tt1 = (ff + d + ss2 + derived[index]) >>> 0;
      const tt2 = (gg + h + ss1 + words[index]) >>> 0;
      d = c;
      c = rotateLeft(b, 9);
      b = a;
      a = tt1;
      h = g;
      g = rotateLeft(f, 19);
      f = e;
      e = (tt2 ^ rotateLeft(tt2, 9) ^ rotateLeft(tt2, 17)) >>> 0;
    }

    state[0] = (state[0] ^ a) >>> 0;
    state[1] = (state[1] ^ b) >>> 0;
    state[2] = (state[2] ^ c) >>> 0;
    state[3] = (state[3] ^ d) >>> 0;
    state[4] = (state[4] ^ e) >>> 0;
    state[5] = (state[5] ^ f) >>> 0;
    state[6] = (state[6] ^ g) >>> 0;
    state[7] = (state[7] ^ h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  state.forEach((value, index) => outputView.setUint32(index * 4, value, false));
  return [...output];
}

function rc4(text: string, key = "y"): string {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let index = 0; index < 256; index++) {
    j = (j + state[index] + key.charCodeAt(index % key.length)) % 256;
    [state[index], state[j]] = [state[j], state[index]];
  }

  let i = 0;
  j = 0;
  let result = "";
  for (const character of text) {
    i = (i + 1) % 256;
    j = (j + state[i]) % 256;
    [state[i], state[j]] = [state[j], state[i]];
    result += String.fromCharCode(
      state[(state[i] + state[j]) % 256] ^ character.charCodeAt(0),
    );
  }
  return result;
}

function randomSignatureBytes(
  setBit: number,
  lowMask: number,
  highMask: number,
  highExtra: number,
): number[] {
  const value = Math.floor(Math.random() * 10_000);
  const low = value & 255;
  const high = value >> 8;
  return [
    (low & 170) | setBit,
    (low & 85) | lowMask,
    (high & 170) | highMask,
    (high & 85) | highExtra,
  ];
}

function encodeABogus(text: string): string {
  const alphabet = "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe";
  let result = "";
  for (let index = 0; index < text.length; index += 3) {
    const first = text.charCodeAt(index);
    const second = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
    const third = index + 2 < text.length ? text.charCodeAt(index + 2) : 0;
    const value = (first << 16) | (second << 8) | third;
    result += alphabet[(value & 0xfc0000) >>> 18];
    result += alphabet[(value & 0x03f000) >>> 12];
    if (index + 1 < text.length) result += alphabet[(value & 0x000fc0) >>> 6];
    if (index + 2 < text.length) result += alphabet[value & 0x3f];
  }
  return result + "=".repeat((4 - result.length % 4) % 4);
}

function generateABogus(query: string): string {
  const browser = "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel";
  const uaCode = [
    76, 98, 15, 131, 97, 245, 224, 133, 122, 199, 241, 166, 79, 34, 90, 191,
    128, 126, 122, 98, 66, 11, 14, 40, 49, 110, 110, 173, 67, 96, 138, 252,
  ];
  const encoder = new TextEncoder();
  const paramsHash = sm3(new Uint8Array(sm3(encoder.encode(`${query}cus`))));
  const methodHash = sm3(new Uint8Array(sm3(encoder.encode("GETcus"))));
  const started = Date.now();
  const ended = started + 6;
  const values = [
    44, (ended >>> 24) & 255, 0, 0, 0, 0, 24, paramsHash[21], methodHash[21], 0,
    uaCode[23], (ended >>> 16) & 255, 0, 0, 0, 1, 0, 239, paramsHash[22],
    methodHash[22], uaCode[24], (ended >>> 8) & 255, 0, 0, 0, 0, ended & 255, 0, 0, 14,
    (started >>> 24) & 255, (started >>> 16) & 255, 0, (started >>> 8) & 255,
    started & 255, 3, Math.floor(ended / 2 ** 32), 1, Math.floor(started / 2 ** 32),
    1, browser.length, 0, 0, 0,
  ];
  let checksum = 0;
  for (const value of values) checksum ^= value;

  const prefix = [
    ...randomSignatureBytes(1, 2, 5, 40),
    ...randomSignatureBytes(1, 0, 0, 0),
    ...randomSignatureBytes(1, 0, 5, 0),
  ].map((value) => String.fromCharCode(value)).join("");
  const payload = [...values, ...[...browser].map((value) => value.charCodeAt(0)), checksum]
    .map((value) => String.fromCharCode(value))
    .join("");
  return encodeABogus(prefix + rc4(payload));
}

function firstAllowedVideoUrl(values: unknown): string {
  if (!Array.isArray(values)) return "";
  const urls = values.filter((value): value is string =>
    typeof value === "string" && isAllowedVideoUrl(value)
  );

  // douyinvod CDN 直链现在会校验 Referer；用户把链接粘贴到新标签页时可能 403。
  // 同一 url_list 中的 www.douyin.com 播放入口会在浏览器中带正确 Referer 跳转到
  // 完全相同的官方 MP4，因此优先返回它，兼顾直链复制和 Range 下载。
  return urls.find((value) => {
    const url = new URL(value);
    return url.hostname === "www.douyin.com" &&
      /^\/aweme\/v1\/play\/$/.test(url.pathname);
  }) ?? urls[0] ?? "";
}

function firstAllowedImageUrl(values: unknown): string {
  if (!Array.isArray(values)) return "";
  return values.find((value): value is string =>
    typeof value === "string" && isAllowedImageUrl(value)
  ) ?? "";
}

function pickBestOfficialVideo(video: OfficialVideo | undefined): OfficialVideoCandidate | null {
  const candidates: OfficialVideoCandidate[] = [];
  for (const rate of video?.bit_rate ?? []) {
    const address = rate.play_addr;
    const url = firstAllowedVideoUrl(address?.url_list);
    if (!url) continue;
    candidates.push({
      bitrate: numericValue(rate.bit_rate),
      height: numericValue(address?.height),
      isH265: rate.is_h265 === 1 || /(?:hvc1|bytevc1)/i.test(url),
      size: numericValue(address?.data_size),
      url,
      width: numericValue(address?.width),
    });
  }

  if (candidates.length === 0) {
    const address = video?.play_addr;
    const url = firstAllowedVideoUrl(address?.url_list);
    if (url) {
      candidates.push({
        bitrate: 0,
        height: numericValue(address?.height),
        isH265: false,
        size: numericValue(address?.data_size),
        url,
        width: numericValue(address?.width),
      });
    }
  }

  const compatible = candidates.filter((candidate) => !candidate.isH265);
  const pool = compatible.length > 0 ? compatible : candidates;
  pool.sort((left, right) =>
    right.width * right.height - left.width * left.height ||
    right.bitrate - left.bitrate ||
    right.size - left.size
  );
  return pool[0] ?? null;
}

async function resolveWithOfficialApi(awemeId: string): Promise<DouyinVideoInfo> {
  const registerResponse = await fetchWithTimeout(TTVID_REGISTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": DOUYIN_USER_AGENT,
    },
    body: JSON.stringify({
      region: "cn",
      aid: 1768,
      needFid: false,
      service: "www.ixigua.com",
      migrate_info: { ticket: "", source: "node" },
      cbUrlProtocol: "https",
      union: true,
    }),
  });

  if (!registerResponse.ok) {
    throw new Error("抖音游客会话初始化失败");
  }
  const ttwid = getResponseCookie(registerResponse, "ttwid");
  if (!ttwid) {
    throw new Error("抖音游客会话未返回 ttwid Cookie");
  }
  try {
    await registerResponse.body?.cancel();
  } catch {
    // 部分边缘运行时不支持主动取消响应体，不影响后续请求。
  }

  // 抖音的 Argus 网关现在要求请求同时携带平台签发的 UIFID。
  // 首页 HEAD 响应虽然是 404，但会下发 UIFID_TEMP、ttwid 等游客身份 Cookie；
  // 普通 GET 只下发 __ac_nonce，无法通过详情接口的前置校验。
  const bootstrapResponse = await fetchWithTimeout(DOUYIN_HOME_URL, {
    method: "HEAD",
    headers: {
      "Accept-Language": "zh-CN,zh;q=0.9",
      "User-Agent": DOUYIN_USER_AGENT,
    },
    redirect: "follow",
  });
  // 抖音不会稳定地向数据中心出口（例如 Vercel）下发 UIFID_TEMP。
  // 当前 Argus 网关只要求 uifid 参数、请求头和 Cookie 三者同值；没有平台
  // Cookie 时生成一次性访客标识，避免把部署环境误判为无效链接。
  const uifidCookie = getResponseCookie(bootstrapResponse, "UIFID_TEMP") ||
    `UIFID_TEMP=${generateUifid()}`;
  const uifid = uifidCookie.slice("UIFID_TEMP=".length);
  const cookie = [
    getResponseCookie(bootstrapResponse, "ttwid") || ttwid,
    uifidCookie,
    getResponseCookie(bootstrapResponse, "web_sign_token"),
    getResponseCookie(bootstrapResponse, "enter_pc_once"),
  ].filter(Boolean).join("; ");
  try {
    await bootstrapResponse.body?.cancel();
  } catch {
    // 同上：响应体是否可主动取消不影响 Cookie 使用。
  }

  const params = new URLSearchParams({
    device_platform: "webapp",
    aid: "6383",
    channel: "channel_pc_web",
    pc_client_type: "1",
    version_code: "290100",
    version_name: "29.1.0",
    cookie_enabled: "true",
    screen_width: "1920",
    screen_height: "1080",
    browser_language: "zh-CN",
    browser_platform: "Win32",
    browser_name: "Chrome",
    browser_version: "130.0.0.0",
    browser_online: "true",
    engine_name: "Blink",
    engine_version: "130.0.0.0",
    os_name: "Windows",
    os_version: "10",
    cpu_core_num: "12",
    device_memory: "8",
    platform: "PC",
    downlink: "10",
    effective_type: "4g",
    from_user_page: "1",
    locate_query: "false",
    need_time_list: "1",
    pc_libra_divert: "Windows",
    publish_video_strategy_type: "2",
    round_trip_time: "0",
    show_live_replay_strategy: "1",
    time_list_query: "0",
    whale_cut_token: "",
    update_version_code: "170400",
    aweme_id: awemeId,
    uifid,
    msToken: "",
  });
  params.set("a_bogus", generateABogus(params.toString()));

  const response = await fetchWithTimeout(`${DOUYIN_DETAIL_URL}?${params.toString()}`, {
    headers: {
      "Accept": "application/json",
      "Cookie": cookie,
      "Referer": DOUYIN_HOME_URL,
      "User-Agent": DOUYIN_USER_AGENT,
      "uifid": uifid,
      "x-tt-argus": "1",
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const reason = detail.trim().slice(0, 160);
    throw new Error(
      `抖音官方详情请求失败: ${response.status}${reason ? ` (${reason})` : ""}`,
    );
  }

  const payload = await response.json() as OfficialDetailPayload;
  const detail = payload.aweme_detail;
  if (!detail) {
    throw new Error(payload.status_msg || "抖音官方详情未返回作品数据");
  }

  const video = pickBestOfficialVideo(detail.video);
  const images = (detail.images ?? [])
    .map((image) => firstAllowedImageUrl(image.url_list))
    .filter(Boolean);
  if (!video && images.length === 0) {
    throw new Error("抖音作品没有可下载的公开视频或图片资源");
  }

  const statistics = detail.statistics;
  return {
    aweme_id: detail.aweme_id ?? awemeId,
    comment_count: numericValue(statistics?.comment_count) || null,
    digg_count: numericValue(statistics?.digg_count) || null,
    share_count: numericValue(statistics?.share_count) || null,
    collect_count: numericValue(statistics?.collect_count) || null,
    nickname: detail.author?.nickname ?? null,
    signature: detail.author?.signature ?? null,
    desc: detail.desc ?? null,
    create_time: detail.create_time
      ? formatDate(new Date(detail.create_time * 1000))
      : null,
    video_url: video?.url ?? null,
    type: video ? "video" : "img",
    image_url_list: images,
  };
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
  let awemeId = extractAwemeId(url);
  let officialError: unknown;
  try {
    const page = await fetchDouyinPage(url);
    awemeId = awemeId || extractAwemeId(page.finalUrl) || extractAwemeId(page.body);
    const legacy = parseLegacyPage(page.body);
    if (legacy?.video_url || (legacy?.image_url_list?.length ?? 0) > 0) return legacy;
  } catch {
    // 分享页被风控或结构变化时，继续使用作品 ID 与备用解析流程。
  }

  if (awemeId) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await resolveWithOfficialApi(awemeId);
      } catch (error) {
        officialError = error;
      }
    }
    // 官方游客接口连续失败时，最后再尝试可配置的备用解析服务。
  }

  try {
    return await resolveWithFallback(url);
  } catch (fallbackError) {
    if (officialError instanceof Error) throw officialError;
    throw fallbackError;
  }
}

async function getVideoUrl(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  if (!info.video_url) {
    throw new Error("该抖音链接没有可下载的视频资源");
  }
  return info.video_url;
}

export { getVideoInfo, getVideoUrl };
