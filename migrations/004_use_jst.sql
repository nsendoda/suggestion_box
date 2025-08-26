-- 003_use_jst.sql
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- letters を作り直し（DEFAULT と updated_at トリガを JST に）
CREATE TABLE letters_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   TEXT    NOT NULL,
  content    TEXT    NOT NULL CHECK (length(content) <= 200),
  status     TEXT    NOT NULL DEFAULT 'inbox'
             CHECK (status IN ('inbox','保持','進行中','完了','棄却')),
  -- ← JST で保存
  created_at TEXT    NOT NULL DEFAULT (datetime('now','+9 hours')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now','+9 hours'))
);

-- 既存データを UTC → JST (+9h) に補正して移し替え
INSERT INTO letters_new (id, owner_id, content, status, created_at, updated_at)
SELECT
  id,
  owner_id,
  content,
  status,
  CASE WHEN created_at IS NULL
       THEN datetime('now','+9 hours')
       ELSE datetime(created_at, '+9 hours')
  END,
  CASE WHEN updated_at IS NULL
       THEN datetime('now','+9 hours')
       ELSE datetime(updated_at, '+9 hours')
  END
FROM letters;

DROP TABLE letters;
ALTER TABLE letters_new RENAME TO letters;

-- インデックス再作成
CREATE INDEX IF NOT EXISTS idx_letters_status_owner ON letters(status, owner_id);

-- UPDATE 時は JST で updated_at を自動更新
CREATE TRIGGER IF NOT EXISTS trg_letters_updated
AFTER UPDATE ON letters
FOR EACH ROW
BEGIN
  UPDATE letters
  SET updated_at = datetime('now','+9 hours')
  WHERE id = OLD.id;
END;


-- owners.created_at も JST で保存したい場合（任意）
CREATE TABLE owners_new (
  id           TEXT PRIMARY KEY,
  display_name TEXT,
  pw_salt      TEXT NOT NULL,
  pw_hash      TEXT NOT NULL,
  keep_limit   INTEGER NOT NULL DEFAULT 3,
  is_admin     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','+9 hours'))
);

INSERT INTO owners_new (id, display_name, pw_salt, pw_hash, keep_limit, is_admin, created_at)
SELECT
  id, display_name, pw_salt, pw_hash, keep_limit, is_admin,
  CASE WHEN created_at IS NULL
       THEN datetime('now','+9 hours')
       ELSE datetime(created_at, '+9 hours')
  END
FROM owners;

DROP TABLE owners;
ALTER TABLE owners_new RENAME TO owners;

COMMIT;
PRAGMA foreign_keys = ON;
