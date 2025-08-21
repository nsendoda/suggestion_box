// functions/api/me.ts
type Env = { DB: D1Database };

// Cookie を読むヘルパ
const getCookie = (req: Request, name: string) =>
  (req.headers.get('cookie') || '')
    .split(/;\s*/)
    .map((p) => p.split('=').map(decodeURIComponent))
    .find(([k]) => k === name)?.[1];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // 1) もし sb_uid を直接入れている運用なら最優先で返す
    const uid = getCookie(request, 'sb_uid');
    if (uid) return json({ ok: true, ownerId: uid });

    // 2) セッションCookie
    const sid = getCookie(request, 'sb_session');
    if (!sid) return json({ ok: false }, 401);

    // 3) sessions ↔ owners を参照（あなたの D1 スキーマに合わせてある）
    const row = await env.DB.prepare(
      `SELECT o.id               AS ownerId,
              o.display_name     AS displayName,
              s.expires_at       AS expiresAt
         FROM sessions s
         JOIN owners   o ON o.id = s.owner_id
        WHERE s.token = ?`
    )
      .bind(sid)
      .first<{ ownerId: string; displayName: string; expiresAt: number }>();

    if (!row) return json({ ok: false }, 401);

    // 4) 期限切れ判定（expires_at は UNIX 秒）
    const now = Math.floor(Date.now() / 1000);
    if (row.expiresAt <= now) return json({ ok: false }, 401);

    return json({ ok: true, ownerId: row.ownerId, displayName: row.displayName });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
};
