// functions/api/owners/[ownerId]/draw.ts
type Env = { DB: D1Database };
const LIMIT = 5;

export const onRequestPost: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const ownerId = String((params as any).ownerId);

    // 保持(=保留)のみで判定（進行中は上限に含めない）
    const kept =
      (
        await env.DB.prepare(
          'SELECT count(*) AS cnt FROM letters WHERE owner_id=? AND status="保持"'
        )
          .bind(ownerId)
          .first<{ cnt: number }>()
      )?.cnt ?? 0;

    if (kept >= LIMIT) {
      return new Response(JSON.stringify({ error: `limit ${LIMIT}` }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) inbox からランダムに 1 件
    const pick = await env.DB.prepare(
      'SELECT id, content FROM letters WHERE owner_id=? AND status="inbox" ORDER BY random() LIMIT 1'
    )
      .bind(ownerId)
      .first<{ id: number; content: string }>();

    if (!pick) {
      return new Response(JSON.stringify({ error: "no letters in inbox" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3) 状態を 保持 に更新（UI 表示は“保留”）
    await env.DB.prepare(
      "UPDATE letters SET status=\"保持\", updated_at=datetime('now','+9 hours') WHERE id=?"
    )
      .bind(pick.id)
      .run();

    return new Response(JSON.stringify(pick), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "draw failed", detail: String(e?.message || e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
