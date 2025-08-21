// functions/api/letters/[id].ts
type Env = { DB: D1Database };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const idRaw = (params as any).id;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) return json({ error: 'invalid id' }, 400);

  const row = await env.DB
    .prepare('SELECT id, owner_id, content, status, created_at, updated_at FROM letters WHERE id=?')
    .bind(id)
    .first<{ id:number; owner_id:string; content:string; status:string; created_at:string; updated_at:string }>();

  if (!row) return json({ error: 'not found' }, 404);

  // 公開APIなのでそのまま返す（必要なら owner_id を隠す等の調整を）
  return json(row);
};
