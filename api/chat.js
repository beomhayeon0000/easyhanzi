// Vercel serverless function: /api/chat
// Nhận tin nhắn từ trình duyệt, gọi Anthropic API bằng key bí mật lưu trên server,
// rồi trả lời về. API key KHÔNG bao giờ lộ ra trình duyệt vì code này chỉ chạy trên server.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Thiếu nội dung tin nhắn" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server chưa cấu hình ANTHROPIC_API_KEY" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "Bạn là trợ lý học tiếng Trung thân thiện tên EasyHanzi Bot, trả lời bằng tiếng Việt, " +
          "ngắn gọn, tập trung giải thích chữ Hán, pinyin, nghĩa, cách dùng và mẹo ghi nhớ. " +
          "Nếu người dùng hỏi ngoài chủ đề học tiếng Trung, vẫn trả lời lịch sự nhưng gợi ý quay lại chủ đề học.",
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || "Lỗi gọi API" });
      return;
    }

    const text = (data.content || []).map((b) => b.text || "").join("\n");
    res.status(200).json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: "Lỗi kết nối server" });
  }
}
