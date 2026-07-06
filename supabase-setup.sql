-- Chạy toàn bộ đoạn này trong Supabase SQL Editor (1 lần duy nhất)

-- Bảng lưu trạng thái tài khoản: đã trả tiền hay chưa, mã chuyển khoản riêng
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  payment_code text,
  is_paid boolean default false,
  created_at timestamp with time zone default now()
);

-- Tự động tạo 1 dòng profile mỗi khi có người đăng ký tài khoản mới
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, payment_code)
  values (new.id, new.email, substr(replace(new.id::text, '-', ''), 1, 8));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Bật bảo mật theo dòng (Row Level Security)
alter table public.profiles enable row level security;

-- Người dùng chỉ được xem thông tin của chính mình
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Lưu ý: KHÔNG tạo policy "update" cho client — nghĩa là is_paid
-- chỉ có thể được đổi bởi bạn (admin) qua Table Editor, không ai
-- tự sửa được từ giao diện web. Đây chính là phần "duyệt thủ công".
