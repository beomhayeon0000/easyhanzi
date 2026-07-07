import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

// Đổi 3 dòng này thành thông tin tài khoản ngân hàng thật của bạn
const BANK_INFO = {
  bankName: "Vietinbank",
  accountNumber: "102874604142",
  accountHolder: "PHAM THI HA QUYEN",
  amount: "99,000đ",
};

export default function AuthPanel({ onAuthChange }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      onAuthChange && onAuthChange({ session: null, profile: null });
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        onAuthChange && onAuthChange({ session, profile: data });
      });
  }, [session]);

const submit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);
  const { error } =
    mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
  setLoading(false);
  if (error) setError(error.message);
};

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const boxStyle = {
    border: "1px solid #D8CCAE",
    background: "#F4EEDE",
    borderRadius: 10,
    padding: 20,
    maxWidth: 380,
    margin: "0 auto",
  };

  if (!session) {
    return (
      <div style={boxStyle}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: "center" }}>
          <button onClick={() => setMode("login")} style={{ fontWeight: mode === "login" ? 700 : 400 }}>
            Đăng nhập
          </button>
          <button onClick={() => setMode("signup")} style={{ fontWeight: mode === "signup" ? 700 : 400 }}>
            Đăng ký
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: 10, borderRadius: 8, border: "1px solid #D8CCAE" }}
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #D8CCAE" }}
          />
          {error && <div style={{ color: "#B8432F", fontSize: 13 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: 10, borderRadius: 8, background: "#4C7A6D", color: "#fff", border: "none" }}
          >
            {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>
      </div>
    );
  }

  if (profile && !profile.is_paid) {
    return (
      <div style={boxStyle}>
        <div style={{ marginBottom: 10 }}>
          Xin chào <b>{session.user.email}</b>. Tài khoản của bạn chưa mở khóa Cấp 3-7.
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          Chuyển khoản theo thông tin sau:
          <br />
          Ngân hàng: <b>{BANK_INFO.bankName}</b>
          <br />
          Số tài khoản: <b>{BANK_INFO.accountNumber}</b>
          <br />
          Chủ tài khoản: <b>{BANK_INFO.accountHolder}</b>
          <br />
          Số tiền: <b>{BANK_INFO.amount}</b>
          <br />
          Nội dung chuyển khoản (bắt buộc, để được duyệt nhanh):{" "}
          <b style={{ color: "#B8432F" }}>{profile.payment_code}</b>
        </div>
        <div style={{ fontSize: 12, color: "#6B5F52", marginTop: 10 }}>
          Sau khi chuyển khoản, tài khoản sẽ được mở trong vòng 24 giờ (duyệt thủ công).
        </div>
        <button onClick={logout} style={{ marginTop: 14 }}>
          Đăng xuất
        </button>
      </div>
    );
  }

  if (profile && profile.is_paid) {
    return (
      <div style={boxStyle}>
        <div>
          Xin chào <b>{session.user.email}</b> — tài khoản đã mở khóa toàn bộ 7 cấp độ.
        </div>
        <button onClick={logout} style={{ marginTop: 14 }}>
          Đăng xuất
        </button>
      </div>
    );
  }

  return <div style={boxStyle}>Đang tải...</div>;
}
