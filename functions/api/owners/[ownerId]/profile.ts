// functions/api/owners/[ownerId]/profile.ts
type Env = { DB: D1Database };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const ownerId = String((params as any).ownerId || '').trim().toLowerCase();
  if (!ownerId) return json({ error: 'ownerId missing' }, 400);

  const row = await env.DB
    .prepare('SELECT id, display_name, keep_limit FROM owners WHERE id=?')
    .bind(ownerId)
    .first<{ id: string; display_name: string; keep_limit: number }>();

  if (!row) return json({ error: 'not found' }, 404);

  return json({
    id: row.id,
    displayName: row.display_name,
    keepLimit: row.keep_limit,
  });
};
