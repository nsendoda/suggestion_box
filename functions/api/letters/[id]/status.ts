// functions/api/owners/[ownerId]/letters/[id]/status.ts
type Env = { DB: D1Database };

export const onRequestPost: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const { ownerId, id } = params as any;
  const { status } = (await request.json()) as {
    status: "完了" | "棄却" | "保持" | "進行中";
  };

  if (!ownerId || !id) return json({ error: "bad params" }, 400);
  if (!["完了", "棄却", "保持", "進行中"].includes(status))
    return json({ error: "bad status" }, 400);

  // 上限チェック（保持/進行中に変更する時のみ）
  if (status === "保持" || status === "進行中") {
    const limitRow = await env.DB.prepare(
      "SELECT keep_limit AS lim FROM owners WHERE id=?"
    )
      .bind(ownerId)
      .first<{ lim: number }>();
    const lim = limitRow?.lim ?? 3;

    const kept =
      (
        await env.DB.prepare(
          'SELECT count(*) AS cnt FROM letters WHERE owner_id=? AND status IN ("保持","進行中") AND id<>?'
        )
          .bind(ownerId, id)
          .first<{ cnt: number }>()
      )?.cnt ?? 0;

    if (kept >= lim) return json({ error: `limit ${lim}` }, 409);
  }

  await env.DB.prepare(
    "UPDATE letters SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?"
  )
    .bind(status, id, ownerId)
    .run();

  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
