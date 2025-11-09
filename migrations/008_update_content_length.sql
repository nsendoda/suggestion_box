-- 投書の文字数制限を200文字から300文字に変更
-- SQLiteではCHECK制約を直接変更できないため、テーブルを再作成

-- 1. 既存テーブルをバックアップ
ALTER TABLE letters RENAME TO letters_old;

-- 2. 新しい制約で再作成（300文字制限）
CREATE TABLE letters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT    NOT NULL,
  content     TEXT    NOT NULL CHECK (length(content) <= 300), -- 300文字に変更
  status      TEXT    NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', '保持', '進行中', '完了', '棄却')),
  progress    INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. データを移行
INSERT INTO letters (id, owner_id, content, status, progress, created_at, updated_at)
SELECT id, owner_id, content, status, progress, created_at, updated_at
FROM letters_old;

-- 4. 古いテーブルを削除
DROP TABLE letters_old;

-- 5. インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_letters_owner_status ON letters(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status);
