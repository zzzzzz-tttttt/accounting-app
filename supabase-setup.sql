-- ===================================================
-- 记账 App Supabase 数据库设置
-- 在 Supabase SQL Editor 中执行此文件
-- ===================================================

-- 🚨 如果重建表（数据会丢）：
-- DROP TABLE IF EXISTS transactions;

-- ===================================================
-- 1. 交易记录表
-- ===================================================
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

-- 索引：加速按用户+日期查询
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, date DESC);

-- 开启行级安全
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 删掉可能存在的宽松旧策略
DROP POLICY IF EXISTS "允许所有操作" ON transactions;
DROP POLICY IF EXISTS "用户只能访问自己的数据" ON transactions;

-- 核心安全策略：每个用户只能读写自己的数据
CREATE POLICY "用户只能访问自己的数据" ON transactions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================================================
-- 2. 应用配置表（后续存 Dify API Key 等）
-- ===================================================
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 开启 RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- 任何人都能读（不含敏感信息时），只有特定管理员能写
-- 先建宽松策略，后续换 Dify 直连时再收紧
CREATE POLICY "所有人可读配置" ON app_config FOR SELECT USING (true);

-- 插入默认配置（无 Key 时占位）
INSERT INTO app_config (key, value)
VALUES ('dify_accounting_key', '')
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value)
VALUES ('dify_correction_key', '')
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value)
VALUES ('dify_stats_key', '')
ON CONFLICT (key) DO NOTHING;
