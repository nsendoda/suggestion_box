-- ============================================
-- 001_init.sql  –  初期テーブル & インデックス
-- ============================================

-- 1) 文字コードや外部キー制約を明示（念のため）
PRAGMA foreign_keys = ON;

-- 2) 投書テーブル
CREATE TABLE IF NOT EXISTS letters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,         -- 一意ID
  owner_id   TEXT    NOT NULL,                          -- オーナーユーザー識別子
  content    TEXT    NOT NULL CHECK (length(content) <= 200), -- 投書本文（最大200文字）
  status     TEXT    NOT NULL DEFAULT 'inbox'           -- inbox, 保持, 完了, 棄却
                     CHECK (status IN ('inbox','保持','完了','棄却')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 作成日時
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP  -- 更新日時
);

-- 3) ステータス＆オーナーで引きやすくする
CREATE INDEX IF NOT EXISTS idx_letters_status_owner
  ON letters (status, owner_id);

-- 4) UPDATE 時に updated_at を自動更新
CREATE TRIGGER IF NOT EXISTS trg_letters_updated
AFTER UPDATE ON letters
FOR EACH ROW
BEGIN
  UPDATE letters
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;
END;
