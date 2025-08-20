-- セッション格納（期限切れ掃除は任意）
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL -- Unix epoch (seconds)
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
