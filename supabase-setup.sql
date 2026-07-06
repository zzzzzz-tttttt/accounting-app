-- 🚨 如果你之前建过 transactions 表，先删掉重建（数据会丢，谨慎！）
-- DROP TABLE IF EXISTS transactions;

-- 记账 App 数据库表
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount FLOAT8 NOT NULL,
  date TEXT NOT NULL,
  tag TEXT NOT NULL,
  "superCat" TEXT,
  "superEmoji" TEXT,
  note TEXT,
  "createdAt" TEXT
);

-- 开启行级安全
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 删除旧的宽松策略（如果有的话）
DROP POLICY IF EXISTS "允许所有操作" ON transactions;

-- 🛡️ 核心安全策略：用户只能读自己的数据，Supabase 自动用登录态过滤
CREATE POLICY "用户只能访问自己的数据" ON transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 如果你想替换 device_id 为 user_id（从旧表迁移），先跑这个：
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID;
-- UPDATE transactions SET user_id = auth.uid() WHERE user_id IS NULL;
