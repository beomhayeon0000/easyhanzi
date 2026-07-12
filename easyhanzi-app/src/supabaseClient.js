import { createClient } from "@supabase/supabase-js";

// Các giá trị này lấy từ file .env.local (chạy máy bạn)
// hoặc từ Environment Variables trong Vercel (khi deploy thật).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
