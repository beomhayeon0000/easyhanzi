// Vercel Edge Function: /api/subtitles?videoId=XXXXXXXXXXX
// Lấy phụ đề tiếng Trung (giản thể) của video YouTube bằng endpoint nội bộ
// timedtext của chính YouTube (không cần yt-dlp/Python, không cần ytdl-core)
// rồi trả về dạng JSON [{ start, end, text }, ...] cho trình duyệt tự đồng bộ
// với video. Chỉ dùng fetch() thuần nên chạy được ở Edge Runtime — nhanh hơn,
// không bị giới hạn thời gian chạy như Node serverless function thông thường.
//
// Lưu ý: đây là endpoint không chính thức của YouTube, dùng cho mục đích học
// tập cá nhân. Không phải video nào cũng có phụ đề tiếng Trung (thủ công hoặc
// tự động) — nếu không tìm thấy, API sẽ trả lỗi rõ ràng để hiển thị cho người dùng.

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return json({ error: "videoId không hợp lệ." }, 400);
  }

  const debug = { innertube: null, listHostTried: [], tracksFound: [], attempts: [] };

  // Bước 0: hỏi qua "Innertube" — API nội bộ mà chính trình phát/khung "Hiện bản
  // ghi" của YouTube dùng (khác với endpoint timedtext cũ ở dưới). Nhiều video có
  // transcript hiện trên giao diện nhưng endpoint timedtext không thấy — thường là
  // do 2 API này lấy dữ liệu khác nhau, nên thử cả 2 để tăng khả năng thành công.
  let tracks = await getTracksViaInnertube(videoId);
  debug.innertube = tracks.length ? `found ${tracks.length} track(s)` : "không có kết quả";

  // Bước 1: nếu Innertube không ra gì, thử tiếp endpoint timedtext liệt kê track cũ
  if (!tracks.length) {
    for (const host of ["https://video.google.com", "https://www.youtube.com/api"]) {
      debug.listHostTried.push(host);
      try {
        const listUrl = `${host}/timedtext?type=list&v=${videoId}`;
        const r = await fetch(listUrl);
        if (r.ok) {
          const xml = await r.text();
          const found = parseTrackList(xml);
          if (found.length) {
            tracks = found;
            break;
          }
        }
      } catch (e) {
        // thử domain còn lại
      }
    }
  }
  debug.tracksFound = tracks.map((t) => `${t.lang}${t.kind ? "(" + t.kind + ")" : ""}${t.isDefault ? "*" : ""}`);

  // Bước 2a: nếu có sẵn track tiếng Trung gốc (thủ công hoặc tự động), lấy trực tiếp
  const zhTrack = tracks.find((t) => /^zh/i.test(t.lang));
  if (zhTrack) {
    debug.attempts.push(`direct:${zhTrack.lang}`);
    const cues = zhTrack.baseUrl
      ? await fetchVTTFromBaseUrl(zhTrack.baseUrl)
      : await fetchVTT(videoId, { lang: zhTrack.lang, kind: zhTrack.kind });
    if (cues && cues.length) {
      return json({ cues, lang: zhTrack.lang, auto: zhTrack.kind === "asr" }, 200);
    }
  }

  // Bước 2b: không có track tiếng Trung gốc — yêu cầu YouTube DỊCH track khác
  // (ví dụ tiếng Anh) sang tiếng Trung giản thể, giống khi tự chọn trong menu CC.
  if (tracks.length) {
    const base = tracks.find((t) => t.isDefault) || tracks[0];
    debug.attempts.push(`translate:${base.lang}->zh-Hans`);
    const cues = base.baseUrl
      ? await fetchVTTFromBaseUrl(base.baseUrl, { tlang: "zh-Hans" })
      : await fetchVTT(videoId, { lang: base.lang, kind: base.kind, tlang: "zh-Hans" });
    if (cues && cues.length) {
      return json({ cues, lang: "zh-Hans", auto: true, translatedFrom: base.lang }, 200);
    }
  }

  // Bước 3 (dự phòng): thử đoán trực tiếp như cũ, phòng trường hợp mọi thứ ở trên thất bại
  const candidates = [
    { lang: "zh-Hans" },
    { lang: "zh-CN" },
    { lang: "zh" },
    { lang: "zh-Hant" },
    { lang: "zh-Hans", kind: "asr" },
    { lang: "zh-CN", kind: "asr" },
    { lang: "zh", kind: "asr" },
  ];
  for (const cand of candidates) {
    debug.attempts.push(`guess:${cand.lang}${cand.kind ? "(" + cand.kind + ")" : ""}`);
    const cues = await fetchVTT(videoId, cand);
    if (cues && cues.length) {
      return json({ cues, lang: cand.lang, auto: !!cand.kind }, 200);
    }
  }

  return json(
    {
      error:
        "Không tìm thấy phụ đề tiếng Trung có sẵn cho video này (video có thể tắt phụ đề, hoặc không có track gốc nào để dịch sang tiếng Trung).",
      debug,
    },
    404
  );
}

// Gọi API nội bộ "Innertube" của YouTube (cùng API mà trình phát/khung "Hiện bản
// ghi" trên youtube.com dùng) để lấy danh sách track phụ đề thật, kèm sẵn baseUrl.
// Một số video chỉ trả về phụ đề khi hỏi đúng loại "thiết bị giả lập" — nên thử
// lần lượt vài loại phổ biến thay vì chỉ 1 loại.
async function getTracksViaInnertube(videoId) {
  const clientConfigs = [
    { clientName: "ANDROID", clientVersion: "20.10.38" },
    { clientName: "WEB", clientVersion: "2.20240101.00.00" },
    { clientName: "IOS", clientVersion: "20.10.4" },
  ];

  for (const client of clientConfigs) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { client },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (raw.length) {
        return raw
          .filter((t) => t.baseUrl)
          .map((t) => ({
            lang: t.languageCode || "",
            kind: t.kind || null,
            isDefault: !!t.isDefault,
            baseUrl: t.baseUrl,
          }));
      }
    } catch (e) {
      // thử client tiếp theo
    }
  }
  return [];
}

async function fetchVTTFromBaseUrl(baseUrl, extra = {}) {
  try {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const params = new URLSearchParams({ fmt: "vtt", ...extra });
    const url = `${baseUrl}${sep}${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || !text.includes("-->")) return null;
    return parseVTT(text);
  } catch (e) {
    return null;
  }
}

async function fetchVTT(videoId, { lang, kind, tlang }) {
  try {
    const params = new URLSearchParams({ v: videoId, lang, fmt: "vtt" });
    if (kind) params.set("kind", kind);
    if (tlang) params.set("tlang", tlang);
    const url = `https://www.youtube.com/api/timedtext?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || !text.includes("-->")) return null;
    return parseVTT(text);
  } catch (e) {
    return null;
  }
}

// Phân tích XML danh sách track phụ đề thật sự có sẵn của video
// (dạng <track lang_code="en" kind="asr" lang_default="true"/>...)
function parseTrackList(xml) {
  const tracks = [];
  const re = /<track\b[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    const lang = (tag.match(/lang_code="([^"]*)"/) || [])[1];
    if (!lang) continue;
    const kind = (tag.match(/kind="([^"]*)"/) || [])[1] || null;
    const isDefault = /lang_default="true"/.test(tag);
    tracks.push({ lang, kind, isDefault });
  }
  return tracks;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timeToSec(t) {
  const m = t.match(/(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

function parseVTT(vtt) {
  const lines = vtt.split(/\r?\n/);
  const cues = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("-->")) {
      const [startRaw, endRaw] = line.split("-->");
      const start = timeToSec(startRaw.trim());
      const end = timeToSec(endRaw.trim().split(" ")[0]);
      i++;
      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].replace(/<[^>]+>/g, ""));
        i++;
      }
      const text = textLines.join(" ").replace(/\s+/g, " ").trim();
      if (text) cues.push({ start, end, text });
    }
    i++;
  }
  // Phụ đề tự động của YouTube hay lặp lại dòng giống hệt dòng trước — lọc bớt cho gọn
  return cues.filter((c, idx) => idx === 0 || c.text !== cues[idx - 1].text);
}


