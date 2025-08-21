// functions/api/letters/[id].ts
type Env = { DB: D1Database };
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = Number((params as any).id);
  const row = await env.DB.prepare(
    "SELECT id, owner_id, content, status, created_at, updated_at FROM letters WHERE id=?"
  )
    .bind(id)
    .first();
  if (!row) return new Response("not found", { status: 404 });
  return new Response(JSON.stringify(row), {
    headers: { "Content-Type": "application/json" },
  });
};
