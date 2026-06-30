// Users/pwhcoder/WebstormProjects/douyinVd/douyin.ts
var pattern = /"video":{"play_addr":{"uri":"([a-z0-9]+)"/;
var cVUrl = "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
var statsRegex = /"statistics"\s*:\s*\{([\s\S]*?)\},/;
var regex = /"nickname":\s*"([^"]+)",\s*"signature":\s*"([^"]+)"/;
var ctRegex = /"create_time":\s*(\d+)/;
var descRegex = /"desc":\s*"([^"]+)"/;
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
async function doGet(url) {
  const headers = new Headers();
  headers.set(
      "User-Agent",
      "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36"
  );
  const resp = await fetch(url, { method: "GET", headers });
  return resp;
}
async function parseImgList(body) {
  const content = body.replace(/\\u002F/g, "/").replace(/\//g, "/");
  const reg = /{"uri":"[^\s"]+","url_list":\["(https:\/\/p\d{1,2}-sign.douyinpic.com\/.*?)"/g;
  const urlRet = /"uri":"([^\s"]+)","url_list":/g;
  let imgMatch;
  const firstUrls = [];
  while ((imgMatch = reg.exec(content)) !== null) {
    firstUrls.push(imgMatch[1]);
  }
  let urlMatch;
  const urlList = [];
  while ((urlMatch = urlRet.exec(content)) !== null) {
    urlList.push(urlMatch[1]);
  }
  const urlSet = new Set(urlList);
  const rList = [];
  for (let urlSetKey of urlSet) {
    let t = firstUrls.find((item) => {
      return item.includes(urlSetKey);
    });
    if (t) {
      rList.push(t);
    }
  }
  const filteredRList = rList.filter((url) => !url.includes("/obj/"));
  console.log("filteredRList.length:", filteredRList.length);
  return filteredRList;
}
async function getVideoInfo(url) {
  let type = "video";
  let img_list = [];
  let video_url = "";
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) {
    type = "img";
  }
  if (type == "video") {
    video_url = cVUrl.replace("%s", match[1]);
  } else {
    img_list = await parseImgList(body);
  }
  const auMatch = body.match(regex);
  const ctMatch = body.match(ctRegex);
  const descMatch = body.match(descRegex);
  const statsMatch = body.match(statsRegex);
  if (statsMatch) {
    const innerContent = statsMatch[0];
    const awemeIdMatch = innerContent.match(/"aweme_id"\s*:\s*"([^"]+)"/);
    const commentCountMatch = innerContent.match(/"comment_count"\s*:\s*(\d+)/);
    const diggCountMatch = innerContent.match(/"digg_count"\s*:\s*(\d+)/);
    const playCountMatch = innerContent.match(/"play_count"\s*:\s*(\d+)/);
    const shareCountMatch = innerContent.match(/"share_count"\s*:\s*(\d+)/);
    const collectCountMatch = innerContent.match(/"collect_count"\s*:\s*(\d+)/);
    const douyinVideoInfo = {
      aweme_id: awemeIdMatch ? awemeIdMatch[1] : null,
      comment_count: commentCountMatch ? parseInt(commentCountMatch[1]) : null,
      digg_count: diggCountMatch ? parseInt(diggCountMatch[1]) : null,
      share_count: shareCountMatch ? parseInt(shareCountMatch[1]) : null,
      collect_count: collectCountMatch ? parseInt(collectCountMatch[1]) : null,
      nickname: null,
      signature: null,
      desc: null,
      create_time: null,
      video_url,
      type,
      image_url_list: img_list
    };
    if (auMatch) {
      douyinVideoInfo.nickname = auMatch[1];
      douyinVideoInfo.signature = auMatch[2];
    }
    if (ctMatch) {
      const date = new Date(parseInt(ctMatch[1]) * 1e3);
      douyinVideoInfo.create_time = formatDate(date);
    }
    if (descMatch) {
      douyinVideoInfo.desc = descMatch[1];
    }
    console.log(douyinVideoInfo);
    return douyinVideoInfo;
  } else {
    throw new Error("No stats found in the response.");
  }
}
async function getVideoId(url) {
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) throw new Error("Video ID not found in URL");
  return match[1];
}
async function getVideoUrl(url) {
  const id = await getVideoId(url);
  const downloadUrl = cVUrl.replace("%s", id);
  return downloadUrl;
}

// Users/pwhcoder/WebstormProjects/douyinVd/doubao.ts
var DOUBAO_PLAY_INFO_URL = "https://www.doubao.com/samantha/media/get_play_info";
var DOUBAO_PLAY_INFO_PARAMS = {
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
  web_tab_id: ""
};
function extractFirstUrl(input) {
  const match = input.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : input;
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function getQueryVideoIds(inputUrl) {
  try {
    const parsedUrl = new URL(inputUrl);
    return unique(parsedUrl.searchParams.getAll("video_id"));
  } catch {
    return [];
  }
}
async function doubaoDoGet(url) {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0"
  );
  headers.set("Accept-Language", "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6");
  return await fetch(url, { method: "GET", headers });
}
async function getDoubaoVideoIds(inputUrl) {
  const url = extractFirstUrl(inputUrl);
  const queryVideoIds = getQueryVideoIds(url);
  if (queryVideoIds.length > 0) {
    return queryVideoIds;
  }
  if (!url.includes("doubao.com/thread/")) {
    throw new Error("\u94FE\u63A5\u4E2D\u7F3A\u5C11 video_id \u53C2\u6570\uFF0C\u8BF7\u4F7F\u7528\u8C46\u5305\u89C6\u9891\u5206\u4EAB\u94FE\u63A5\u6216\u8C46\u5305 thread \u94FE\u63A5");
  }
  const resp = await doubaoDoGet(url);
  if (!resp.ok) {
    throw new Error(`\u8C46\u5305\u9875\u9762\u8BF7\u6C42\u5931\u8D25: ${resp.status}`);
  }
  const body = await resp.text();
  const patterns = [
    /{\\&quot;vid\\&quot;:\\&quot;(.*?)\\&quot/g,
    /"vid"\s*:\s*"([^"]+)"/g,
    /\\"vid\\"\s*:\s*\\"([^"\\]+)\\"/g
  ];
  const ids = [];
  for (const pattern2 of patterns) {
    let match;
    while ((match = pattern2.exec(body)) !== null) {
      ids.push(match[1]);
    }
  }
  const videoIds = unique(ids);
  if (videoIds.length === 0) {
    throw new Error("\u672A\u80FD\u4ECE\u8C46\u5305\u94FE\u63A5\u4E2D\u89E3\u6790\u5230\u89C6\u9891 ID");
  }
  return videoIds;
}
async function getDoubaoPlayInfo(videoId) {
  const apiUrl = new URL(DOUBAO_PLAY_INFO_URL);
  for (const [key, value] of Object.entries(DOUBAO_PLAY_INFO_PARAMS)) {
    apiUrl.searchParams.set(key, value);
  }
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/14315 Flue"
  );
  headers.set("Origin", "https://www.doubao.com");
  headers.set("Content-Type", "application/json");
  const resp = await fetch(apiUrl.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({ key: videoId })
  });
  if (!resp.ok) {
    throw new Error(`\u8C46\u5305\u64AD\u653E\u4FE1\u606F\u8BF7\u6C42\u5931\u8D25: ${resp.status}`);
  }
  const result = await resp.json();
  const originalMediaInfo = result.data?.original_media_info;
  const mainUrl = originalMediaInfo?.main_url;
  if (!mainUrl) {
    throw new Error("\u8C46\u5305 API \u8FD4\u56DE\u6570\u636E\u683C\u5F0F\u5F02\u5E38\uFF0C\u53EF\u80FD\u94FE\u63A5\u5DF2\u5931\u6548");
  }
  const meta = originalMediaInfo.meta ?? {};
  return {
    width: meta.width ?? null,
    height: meta.height ?? null,
    definition: meta.definition ?? null,
    duration: meta.duration ?? null,
    codec_type: meta.codec_type ?? null,
    poster_url: result.data?.poster_url ?? null,
    url: mainUrl
  };
}
async function getDoubaoVideoInfo(url) {
  const videoIds = await getDoubaoVideoIds(url);
  const videoList = await Promise.all(videoIds.map((videoId) => getDoubaoPlayInfo(videoId)));
  const videoUrlList = videoList.map((video) => video.url);
  return {
    platform: "doubao",
    type: "video",
    video_url: videoUrlList[0] ?? null,
    video_url_list: videoUrlList,
    video_list: videoList
  };
}
async function getDoubaoVideoUrl(url) {
  const videoInfo = await getDoubaoVideoInfo(url);
  if (!videoInfo.video_url) {
    throw new Error("\u8C46\u5305\u89C6\u9891\u76F4\u94FE\u89E3\u6790\u5931\u8D25");
  }
  return videoInfo.video_url;
}
function isDoubaoUrl(inputUrl) {
  return inputUrl.includes("doubao.com");
}
function errorResponse(error, dataMode) {
  const message = error instanceof Error ? error.message : String(error);
  const help = message.includes("\u672A\u80FD\u4ECE\u8C46\u5305\u94FE\u63A5\u4E2D\u89E3\u6790\u5230\u89C6\u9891 ID") ? "\u8FD9\u4E2A\u8C46\u5305 thread \u91CC\u6CA1\u6709\u516C\u5F00\u53EF\u89E3\u6790\u7684\u89C6\u9891 ID\uFF0C\u53EF\u80FD\u662F\u56FE\u7247/\u6587\u5B57\u5BF9\u8BDD\u3001\u5185\u5BB9\u672A\u516C\u5F00\uFF0C\u6216\u9700\u8981\u767B\u5F55\u540E\u624D\u80FD\u770B\u5230\u89C6\u9891\u3002\u8BF7\u4F7F\u7528\u5305\u542B video_id \u7684\u8C46\u5305\u89C6\u9891\u5206\u4EAB\u94FE\u63A5\uFF0C\u6216\u786E\u8BA4 thread \u4E2D\u6709\u516C\u5F00\u89C6\u9891\u3002" : "\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u94FE\u63A5\u662F\u5426\u6709\u6548\u3002";
  const status = 400;
  if (dataMode) {
    return new Response(JSON.stringify({ error: message, help }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  return new Response(`${message}
${help}`, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

// Users/pwhcoder/WebstormProjects/douyinVd/serve.ts
var handler = async (req) => {
  console.log("Method:", req.method);
  const url = new URL(req.url);
  if (url.searchParams.has("url")) {
    const inputUrl = url.searchParams.get("url");
    console.log("inputUrl:", inputUrl);
    const dataMode = url.searchParams.has("data");
    try {
      if (dataMode) {
        const videoInfo = isDoubaoUrl(inputUrl) ? await getDoubaoVideoInfo(inputUrl) : await getVideoInfo(inputUrl);
        return new Response(JSON.stringify(videoInfo));
      }
      const videoUrl = isDoubaoUrl(inputUrl) ? await getDoubaoVideoUrl(inputUrl) : await getVideoUrl(inputUrl);
      return new Response(videoUrl);
    } catch (error) {
      console.error(error);
      return errorResponse(error, dataMode);
    }
  } else {
    return new Response("\u8BF7\u63D0\u4F9Burl\u53C2\u6570");
  }
};

// Users/pwhcoder/WebstormProjects/douyinVd/cfworker.ts
var cfworker_default = {
  fetch: handler
};
export {
  cfworker_default as default
};
