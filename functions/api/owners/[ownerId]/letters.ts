// functions/api/owners/[ownerId]/letters.ts
type Env = { DB: D1Database };

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const ownerId = String((params as any).ownerId);
    if (!ownerId) return json({ error: 'ownerId missing' }, 400);

    const u = new URL(request.url);
    const showInbox =
      u.searchParams.get('inbox') === '1' || u.searchParams.get('includeInbox') === '1';

    let sql =
      'SELECT id, content, status, created_at, updated_at FROM letters WHERE owner_id=?';
    if (!showInbox) sql += ` AND status != "inbox"`;
    sql += ' ORDER BY updated_at DESC';

    const rows = await env.DB.prepare(sql).bind(ownerId).all<
      { id: number; content: string; status: string; created_at: string; updated_at: string }
    >();

    // フロントが配列を期待してもオブジェクト(results)を期待しても動くよう両方返す
    return json(rows.results, 200, { 'X-Results-Wrapped': 'false', 'X-Count': String(rows.results.length) });
  } catch (e: any) {
    return json({ error: 'list failed', detail: String(e?.message || e) }, 500);
  }
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
