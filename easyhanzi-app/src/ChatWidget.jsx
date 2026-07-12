import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Chào bạn! Mình là trợ lý EasyHanzi, hỏi mình về chữ Hán, pinyin, hoặc cách nhớ từ nhé." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || data.error || "Xin lỗi, có lỗi xảy ra." }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Không kết nối được server." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
      {open && (
        <div
          style={{
            width: 300,
            height: 400,
            background: "#F4EEDE",
            border: "1px solid #D8CCAE",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            marginBottom: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            overflow: "hidden",
          }}
        >
          <div style={{ background: "#24201B", color: "#F4EEDE", padding: "10px 14px", fontSize: 14, fontWeight: 600 }}>
            Trợ lý EasyHanzi
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#4C7A6D" : "#fff",
                  color: m.role === "user" ? "#fff" : "#24201B",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  maxWidth: "80%",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "#8A8072" }}>Đang trả lời...</div>}
          </div>
          <div style={{ display: "flex", borderTop: "1px solid #D8CCAE" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Hỏi về chữ Hán..."
              style={{ flex: 1, border: "none", padding: "10px 12px", fontSize: 13, outline: "none", background: "transparent" }}
            />
            <button onClick={send} style={{ border: "none", background: "transparent", padding: "0 12px", cursor: "pointer" }}>
              <Send size={18} color="#4C7A6D" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#B8432F",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        }}
        aria-label="Mở trợ lý AI"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
