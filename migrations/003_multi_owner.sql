-- 既存セッションは捨ててOK（仕様上すぐ再ログイン可能）
DROP TABLE IF EXISTS sessions;

-- オーナー（ユーザー）
CREATE TABLE IF NOT EXISTS owners (
  id           TEXT PRIMARY KEY,           -- ログインID/URLスラッグ (例: "alice")
  display_name TEXT,
  pw_salt      TEXT NOT NULL,
  pw_hash      TEXT NOT NULL,
  keep_limit   INTEGER NOT NULL DEFAULT 3, -- 保持上限（デフォルト3）
  is_admin     INTEGER NOT NULL DEFAULT 0, -- 最初の1人を管理者に
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 既存データ救済: まだowner1が無ければ追加（仮パス ワンタイム）
INSERT INTO owners (id, display_name, pw_salt, pw_hash, is_admin)
SELECT 'owner1','NoshiOwner','legacy','legacy',1
WHERE NOT EXISTS (SELECT 1 FROM owners WHERE id='owner1');

-- letters.owner_id は TEXT のままでOK（owner1 で運用済み想定）
-- 必要なら NOT NULL 制約を付ける:
-- ALTER TABLE letters RENAME TO letters_old;
-- CREATE TABLE letters (... 同じカラム + owner_id NOT NULL ...);
-- INSERT INTO letters (...) SELECT ... FROM letters_old; DROP TABLE letters_old;

-- 多人数セッション（owner_id ひもづけ）
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);

-- サインアップ開閉フラグ（即時切替用）
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key, value) VALUES('signups_enabled','1');
