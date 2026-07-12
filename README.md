# EasyHanzi — hướng dẫn triển khai lên tên miền riêng (miễn phí SSL, Vercel)

## Vì sao mình không thể tự mua tên miền / tự deploy giúp bạn
Mình không có khả năng thanh toán (mua tên miền cần thẻ ngân hàng của bạn), không có tài khoản
Vercel/GitHub của bạn, và môi trường chạy code của mình không có kết nối Internet ra ngoài để
gọi API mua domain hay push code lên đâu cả. Vì vậy phần "mua domain" và "bấm nút deploy" bắt
buộc phải do chính bạn thực hiện — nhưng mình đã đóng gói sẵn toàn bộ project để bạn chỉ cần làm
theo các bước dưới đây (khoảng 15-20 phút, không cần biết code).

---

## Bước 1 — Mua tên miền EasyHanzi.com
Mua ở một nhà cung cấp domain bất kỳ, ví dụ:
- Namecheap: https://www.namecheap.com
- GoDaddy: https://www.godaddy.com
- Hoặc mua thẳng trong Vercel (Vercel > Domains > Buy), sẽ tự động kết nối luôn, đỡ bước 4.

Giá thường 8–15 USD/năm cho `.com`.

## Bước 2 — Đưa code lên GitHub
1. Tạo tài khoản GitHub (miễn phí): https://github.com
2. Tạo repository mới, đặt tên `easyhanzi` (Public hoặc Private đều được).
3. Upload toàn bộ nội dung thư mục `easyhanzi-app` (giải nén từ file zip mình gửi) lên
   repository đó — có thể kéo-thả file trực tiếp trên GitHub web, hoặc dùng Git:
   ```
   cd easyhanzi-app
   git init
   git add .
   git commit -m "EasyHanzi first version"
   git branch -M main
   git remote add origin https://github.com/<ten-tai-khoan>/easyhanzi.git
   git push -u origin main
   ```

## Bước 3 — Deploy lên Vercel (miễn phí)
1. Tạo tài khoản tại https://vercel.com (đăng nhập bằng GitHub cho nhanh).
2. Bấm **Add New → Project**, chọn repo `easyhanzi` vừa tạo.
3. Vercel tự nhận diện đây là project Vite — để nguyên cấu hình mặc định:
   - Build Command: `vite build`
   - Output Directory: `dist`
4. Bấm **Deploy**. Sau ~1 phút bạn sẽ có địa chỉ dạng `easyhanzi.vercel.app` chạy được ngay.

## Bước 4 — Gắn tên miền EasyHanzi.com vào project
1. Trong project trên Vercel → tab **Settings → Domains**.
2. Nhập `easyhanzi.com` → **Add**.
3. Vercel sẽ cho bạn 1-2 bản ghi DNS cần thêm (thường là một bản ghi `A` hoặc `CNAME`).
4. Quay lại nơi bạn mua domain (Namecheap/GoDaddy...) → phần quản lý DNS → thêm đúng bản ghi
   Vercel yêu cầu.
5. Đợi 10 phút đến vài giờ để DNS cập nhật. Vercel sẽ **tự động cấp SSL miễn phí** (Let's
   Encrypt) cho domain ngay khi DNS trỏ đúng — không cần làm gì thêm, ổ khóa https sẽ tự xuất
   hiện.

Nếu bạn mua domain thẳng trong Vercel (Bước 1, cách 3) thì bước này gần như tự động, chỉ cần
bấm xác nhận.

---

## PHẦN B — Đăng nhập + khóa Cấp 3-7 sau thanh toán (Supabase)

### B1. Tạo project Supabase
1. Vào https://supabase.com → đăng nhập bằng GitHub → **New Project**.
2. Đặt tên `easyhanzi`, tạo mật khẩu DB (lưu lại), chọn vùng **Southeast Asia (Singapore)**.
3. Đợi ~2 phút để khởi tạo xong.
4. Vào **Project Settings → API**, copy lại **Project URL** và **anon public key**.
5. Vào **SQL Editor → New query**, dán toàn bộ nội dung file `supabase-setup.sql` (đi kèm
   trong project này) rồi bấm **Run**. File này tự tạo bảng `profiles`, tự sinh mã chuyển
   khoản riêng cho mỗi người dùng, và bật bảo mật để chỉ bạn (qua Table Editor) mới đổi được
   trạng thái đã-thanh-toán.
6. Vào **Authentication → Settings**, tắt **Confirm email** để test nhanh (bật lại sau nếu
   muốn chặt chẽ hơn khi ra mắt thật).

### B2. Cấu hình biến môi trường
1. Copy file `.env.example` thành `.env.local` (cùng thư mục gốc project).
2. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` bằng giá trị lấy ở bước B1.4.
3. Khi deploy lên Vercel: vào project → **Settings → Environment Variables** → thêm 2 biến
   trên với đúng tên và giá trị, rồi **Redeploy** lại project (Deployments → ⋯ → Redeploy).

### B3. Sửa thông tin ngân hàng của bạn
Mở file `src/AuthPanel.jsx`, sửa khối `BANK_INFO` ở đầu file (tên ngân hàng, số tài khoản,
chủ tài khoản, số tiền) thành thông tin thật của bạn.

### B4. Cách hoạt động
- Người dùng vào tab **Tài khoản** → đăng ký email/mật khẩu.
- Sau khi đăng ký, họ thấy thông tin chuyển khoản kèm **mã riêng** (8 ký tự, tự sinh) — họ ghi
  mã này vào nội dung chuyển khoản.
- Cấp 1-2 luôn miễn phí; Cấp 3-7 hiện khóa 🔒 cho tới khi tài khoản được duyệt.

### B5. Duyệt thanh toán (thủ công)
1. Khi có người báo đã chuyển khoản, mở https://supabase.com → project của bạn → **Table
   Editor → profiles**.
2. Tìm dòng có `payment_code` khớp với nội dung chuyển khoản trong sao kê ngân hàng của bạn
   (hoặc tìm theo `email`).
3. Bấm vào ô `is_paid` của dòng đó, đổi từ `false` thành `true`, lưu lại.
4. Người dùng chỉ cần tải lại trang là thấy Cấp 3-7 đã mở khóa — không cần họ làm gì thêm.

*(Muốn tự động hóa bước duyệt này sau này — ví dụ qua SePay/Casso để hệ thống tự nhận diện
chuyển khoản và tự bật `is_paid` qua webhook — cứ quay lại hỏi mình, mình sẽ hướng dẫn tiếp.)*

---

## PHẦN C — Chat box tự động

### C1. Widget hỗ trợ trực tiếp (Tawk.to — miễn phí)
1. Vào https://www.tawk.to → **Sign Up** (miễn phí, không giới hạn).
2. Tạo Property mới cho website của bạn (đặt tên `EasyHanzi`, nhập domain `easyhanzi.com`).
3. Vào **Administration → Channels → Chat Widget**, bạn sẽ thấy đoạn mã script kèm ID riêng
   dạng `https://embed.tawk.to/XXXXXXXXXXXX/default`.
4. Mở file `index.html` trong project, tìm dòng `YOUR_WIDGET_ID`, thay bằng ID thật của bạn
   (phần số/chữ giữa `embed.tawk.to/` và `/default`).
5. Commit + push code lên GitHub (Vercel sẽ tự deploy lại) — widget chat sẽ xuất hiện ở góc
   dưới bên phải trang, bạn trả lời tin nhắn ngay trên app Tawk.to (có app điện thoại).

### C2. Trợ lý AI trả lời tự động về từ vựng (Claude API)
1. Vào https://console.anthropic.com → đăng ký/đăng nhập → **Settings → API Keys → Create
   Key**. Copy lại chuỗi bắt đầu bằng `sk-ant-...` (chỉ hiện một lần, lưu lại ngay).
2. **Quan trọng**: KHÔNG dán key này vào bất kỳ file nào trong thư mục `src/` (sẽ lộ công
   khai). Key chỉ được đặt làm biến môi trường server-side, project đã dựng sẵn đúng cách này
   qua file `api/chat.js`.
3. Trong Vercel → project → **Settings → Environment Variables**, thêm biến:
   - Tên: `ANTHROPIC_API_KEY`
   - Giá trị: key vừa copy
4. Redeploy lại project.
5. Nút tròn màu đỏ 💬 ở góc dưới bên phải trang chính là trợ lý AI — người dùng bấm vào, gõ câu
   hỏi về chữ Hán/pinyin/cách nhớ, hệ thống sẽ gọi Claude để trả lời tự động, key API không hề
   lộ ra trình duyệt.
6. Lưu ý chi phí: mỗi câu hỏi tốn một khoản phí nhỏ theo API Anthropic (xem bảng giá tại
   https://www.anthropic.com/pricing) — nên theo dõi mục **Usage** trong console Anthropic để
   kiểm soát chi tiêu.

---

## PHẦN D — Phụ đề tiếng Trung bằng AI (tải file lên, chạy hoàn toàn trên trình duyệt)

Tính năng ở tab **Phụ đề**: chọn 1 file âm thanh/video tiếng Trung có sẵn trên máy
(ví dụ video đã tải về từ YouTube bằng phần mềm quen dùng), AI sẽ tự nghe và tạo
phụ đề, đồng bộ theo đúng thời gian phát — xem ở 2 chế độ: chỉ giản thể, hoặc giản
thể kèm pinyin.

**Không cần đăng ký hay cấu hình gì thêm, không tốn phí** — mọi thứ chạy ngay trên
máy người dùng (dùng Whisper qua `transformers.js`), không tải gì lên server, nên
**không thể bị chặn hay giới hạn** như cách lấy trực tiếp từ link YouTube (đã thử và
bỏ vì hay bị YouTube chặn).

### Cách hoạt động
1. Người dùng bấm **"Chọn file âm thanh/video tiếng Trung"**, chọn file trên máy.
2. Trình duyệt tự giải mã âm thanh, chia nhỏ thành từng đoạn 30 giây.
3. AI (mô hình `whisper-tiny`, chạy trong Web Worker riêng — không làm đơ trang)
   xử lý lần lượt từng đoạn, luôn hiện tiến trình rõ ràng ("Đang xử lý đoạn 5/30...").
   Nếu máy có card đồ họa hỗ trợ WebGPU, tự động dùng để tăng tốc; nếu không, tự
   động lùi về chạy bằng CPU.
4. Xong, video/audio hiện ra kèm phụ đề đồng bộ theo thời gian thực khi phát.

### Lưu ý
- Lần đầu dùng cần tải mô hình AI, các lần sau nhanh hơn nhờ trình duyệt tự lưu cache.
- Nên dùng file dưới 10-15 phút — file càng dài, AI càng mất nhiều thời gian xử lý
  (vì chạy bằng chính máy người dùng, không phải server mạnh).
- Trên điện thoại đời cũ, bước AI xử lý có thể chậm — máy tính hoặc điện thoại đời
  mới có GPU hỗ trợ WebGPU sẽ nhanh hơn nhiều.

---

## Ghi chú kỹ thuật

- Icon hiển thị trên thanh tab trình duyệt (favicon) đã được tạo sẵn từ ảnh nhân vật gấu bạn
  gửi, nằm trong thư mục `public/` (`favicon.ico`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`). Không cần làm gì thêm — Vite tự phục vụ các file trong `public/`
  ở đường dẫn gốc, và `index.html` đã có sẵn các thẻ `<link>` trỏ tới đúng file. Muốn đổi ảnh
  khác, chỉ cần thay các file này (giữ nguyên tên) rồi deploy lại.
- Project dùng Vite + React, không cần Tailwind hay build phức tạp nào khác.
- Thư viện vẽ nét chữ (Hanzi Writer) và font Google được tải trực tiếp từ CDN khi trang chạy
  trong trình duyệt thật — điều này nên hoạt động ổn định hơn so với khung xem trước trong
  Claude, vì không còn bị giới hạn của môi trường sandbox nữa.
- Muốn chạy thử ở máy mình trước khi deploy: cài Node.js rồi chạy:
  ```
  npm install
  npm run dev
  ```
  mở địa chỉ hiện trong terminal (thường là http://localhost:5173). Lưu ý: `api/chat.js` là
  hàm serverless của Vercel, sẽ không chạy được với `npm run dev` thông thường — muốn test
  trợ lý AI cục bộ, cài thêm `npm i -g vercel` rồi chạy `vercel dev` thay vì `npm run dev`.

