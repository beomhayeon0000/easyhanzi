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

  // Thử lần lượt: phụ đề thủ công tiếng Trung giản thể/phồn thể, rồi tới phụ đề
  // tự động (asr) nếu không có bản thủ công.
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
    try {
      const params = new URLSearchParams({ v: videoId, lang: cand.lang, fmt: "vtt" });
      if (cand.kind) params.set("kind", cand.kind);
      const url = `https://www.youtube.com/api/timedtext?${params.toString()}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || !text.includes("-->")) continue;
      const cues = parseVTT(text);
      if (cues.length) {
        return json({ cues, lang: cand.lang, auto: !!cand.kind }, 200);
      }
    } catch (e) {
      // thử phương án tiếp theo
    }
  }

  return json(
    { error: "Không tìm thấy phụ đề tiếng Trung có sẵn cho video này (video có thể không có CC tiếng Trung)." },
    404
  );
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
