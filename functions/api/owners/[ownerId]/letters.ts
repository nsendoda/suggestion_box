// functions/api/owners/[ownerId]/letters.ts
type Env = { DB: D1Database };

/** GET: /api/owners/:ownerId/letters[?inbox=1] */
export const onRequestGet: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  try {
    const ownerId = String((params as any).ownerId || "");
    if (!ownerId) return json({ error: "ownerId missing" }, 400);

    const u = new URL(request.url);
    const showInbox =
      u.searchParams.get("inbox") === "1" ||
      u.searchParams.get("includeInbox") === "1";

    let sql =
      "SELECT id, content, status, created_at, updated_at FROM letters WHERE owner_id=?";
    if (!showInbox) sql += ' AND status != "inbox"';
    sql += " ORDER BY updated_at DESC";

    const rows = await env.DB.prepare(sql)
      .bind(ownerId)
      .all<{
        id: number;
        content: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>();

    return json(rows.results);
  } catch (e: any) {
    return json({ error: "list failed", detail: String(e?.message || e) }, 500);
  }
};

/** POST: /api/owners/:ownerId/letters  (匿名投書の送信) */
export const onRequestPost: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  try {
    const ownerId = String((params as any).ownerId || "");
    if (!ownerId) return json({ error: "ownerId missing" }, 400);

    const body = await request.json().catch(() => ({}));
    let content = (body?.content ?? "").toString().trim();

    if (!content) return json({ error: "content required" }, 400);
    if ([...content].length > 200)
      return json({ error: "too long (<=200 chars)" }, 400);

    // オーナーが存在しない箱への送信を拒否
    const exists = await env.DB.prepare("SELECT 1 FROM owners WHERE id=?")
      .bind(ownerId)
      .first();
    if (!exists) return json({ error: "owner not found" }, 404);

    // JST で作成（サーバ時刻 +9h）
    await env.DB.prepare(
      `INSERT INTO letters (owner_id, content, status, created_at, updated_at)
         VALUES (?, ?, 'inbox', datetime('now','+9 hours'), datetime('now','+9 hours'))`
    )
      .bind(ownerId, content)
      .run();

    return json({ ok: true });
  } catch (e: any) {
    // 200 文字制約など DB エラーもここに落ちる
    return json(
      { error: "create failed", detail: String(e?.message || e) },
      500
    );
  }
};

function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
