// Vercel serverless function (Node runtime — bắt buộc, vì @distube/ytdl-core
// cần các API gốc của Node.js nên KHÔNG chạy được ở Edge Runtime):
// /api/audio-proxy?videoId=XXXXXXXXXXX
//
// Lấy luồng âm thanh (audio-only) trực tiếp từ YouTube rồi chuyển tiếp
// (proxy) dữ liệu về trình duyệt. Bắt buộc phải qua bước này vì trình duyệt
// không tự tải thẳng được link audio gốc của YouTube (bị chặn CORS + link có
// chữ ký, hết hạn nhanh). Dùng riêng cho tính năng "Tạo phụ đề bằng AI"
// (Whisper chạy ngay trên trình duyệt của người dùng).
//
// Lưu ý quan trọng: gói Vercel miễn phí (Hobby) giới hạn thời gian chạy mỗi
// hàm khoảng 10 giây — với video dài, việc lấy + chuyển tiếp âm thanh có thể
// vượt quá giới hạn này và báo lỗi. Vì vậy tính năng này chỉ nên dùng cho các
// video ngắn (khuyến nghị dưới 5 phút).

import ytdl from "@distube/ytdl-core";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "videoId không hợp lệ." });
    return;
  }

  // Bước 1: hỏi YouTube xem video này có những luồng audio nào (bắt buộc dùng
  // ytdl-core, đây là bước YouTube hay chặn nhất theo kinh nghiệm thực tế).
  let info;
  try {
    info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
      requestOptions: { headers: BROWSER_HEADERS },
    });
  } catch (e) {
    const raw = (e && e.message) || "không rõ nguyên nhân";
    res.status(500).json({
      error: "[Bước 1 - lấy thông tin video] " + describeError(raw),
      step: "getInfo",
      raw,
    });
    return;
  }

  const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
  if (!audioFormats.length) {
    res.status(404).json({ error: "Không tìm thấy luồng âm thanh cho video này.", step: "no-audio-format" });
    return;
  }
  // Chọn định dạng nhẹ nhất để tải và xử lý nhanh hơn (đủ dùng cho nhận diện giọng nói)
  const best = [...audioFormats].sort((a, b) => (a.audioBitrate || 0) - (b.audioBitrate || 0))[0];

  // Bước 2: tải luồng audio đã tìm được và chuyển tiếp cho trình duyệt.
  let upstream;
  try {
    upstream = await fetch(best.url, { headers: BROWSER_HEADERS });
  } catch (e) {
    const raw = (e && e.message) || "không rõ nguyên nhân";
    res.status(502).json({
      error: "[Bước 2 - tải audio] " + describeError(raw),
      step: "fetchAudio",
      raw,
    });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    res.status(502).json({
      error: `[Bước 2 - tải audio] YouTube từ chối yêu cầu (mã ${upstream.status}).`,
      step: "fetchAudio",
      raw: "http-" + upstream.status,
    });
    return;
  }

  try {
    res.setHeader("Content-Type", best.mimeType || "audio/mp4");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    // Lỗi ở đây thường là do vượt quá thời gian chạy tối đa của Vercel (video quá dài)
    res.status(500).json({
      error: "[Bước 2 - chuyển tiếp audio] Quá thời gian cho phép — thử video ngắn hơn.",
      step: "streamAudio",
      raw: (e && e.message) || "",
    });
  }
}

function describeError(raw) {
  // Lỗi phổ biến nhất trên các server "đám mây" (Vercel, AWS, Cloudflare...):
  // YouTube chặn IP không phải nhà mạng dân dụng, nghi ngờ là bot.
  const isBotBlock = /sign in|bot|confirm|429|forbidden|403/i.test(raw);
  return isBotBlock
    ? "YouTube đang chặn máy chủ (nghi ngờ là bot) — hạn chế phía YouTube, không sửa được bằng code."
    : "Lỗi: " + raw;
}
