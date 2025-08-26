// functions/api/owners/[ownerId]/letters.ts
type Env = { DB: D1Database };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// 既存の GET に「owner存在チェック」を1行追加
export const onRequestGet: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const ownerId = String((params as any).ownerId).toLowerCase();
  // 追加: 無い owner は 404 に
  const exists = await env.DB.prepare("SELECT 1 FROM owners WHERE id=?")
    .bind(ownerId)
    .first();
  if (!exists) return json({ error: "not found" }, 404);

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
};

// 追加: POST（投書）でも owner の存在を必ず確認
export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
  params,
}) => {
  const ownerId = String((params as any).ownerId).toLowerCase();

  const exists = await env.DB.prepare("SELECT 1 FROM owners WHERE id=?")
    .bind(ownerId)
    .first();
  if (!exists) return json({ error: "owner not found" }, 404);

  // body バリデーション最小限（最大200文字）
  const body = await request.json().catch(() => ({}));
  const content = (body?.content ?? "").trim();
  if (!content || content.length > 200)
    return json({ error: "invalid content" }, 400);

  await env.DB.prepare("INSERT INTO letters (owner_id, content) VALUES (?, ?)")
    .bind(ownerId, content)
    .run();

  return json({ ok: true }, 201);
};
