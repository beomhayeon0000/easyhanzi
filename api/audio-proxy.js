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

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "videoId không hợp lệ." });
    return;
  }

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    if (!audioFormats.length) {
      res.status(404).json({ error: "Không tìm thấy luồng âm thanh cho video này." });
      return;
    }
    // Chọn định dạng nhẹ nhất để tải và xử lý nhanh hơn (đủ dùng cho nhận diện giọng nói)
    const best = [...audioFormats].sort((a, b) => (a.audioBitrate || 0) - (b.audioBitrate || 0))[0];

    const upstream = await fetch(best.url);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "Không tải được luồng âm thanh từ YouTube." });
      return;
    }

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
    res.status(500).json({ error: "Lỗi khi lấy âm thanh: " + (e && e.message ? e.message : "không rõ nguyên nhân") });
  }
}
