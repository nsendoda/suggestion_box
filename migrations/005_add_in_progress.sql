-- 005_add_in_progress.sql（例）
CREATE TABLE letters_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   TEXT NOT NULL,
  content    TEXT NOT NULL CHECK (length(content) <= 200),
  status     TEXT NOT NULL CHECK (status IN ('inbox','保持','進行中','完了','棄却')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO letters_new (id, owner_id, content, status, created_at, updated_at)
SELECT id, owner_id, content, status, created_at, updated_at
FROM letters;

DROP TABLE letters;
ALTER TABLE letters_new RENAME TO letters;

CREATE INDEX IF NOT EXISTS idx_letters_status_owner ON letters(status, owner_id);

CREATE TRIGGER IF NOT EXISTS trg_letters_updated
AFTER UPDATE ON letters
FOR EACH ROW
BEGIN
  UPDATE letters SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
