// functions/api/letters/[id]/progress.ts
type Env = { DB: D1Database };

/** PUT: /api/letters/:id/progress - 進行中の投書の進捗率を更新 */
export const onRequestPut: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  try {
    const { id } = params as any;
    const { progress } = (await request.json()) as { progress: number };

    if (!id) return json({ error: "id missing" }, 400);
    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return json({ error: "progress must be 0-100" }, 400);
    }

    // 進行中ステータスのレコードのみ更新可能
    const result = await env.DB.prepare(
      `UPDATE letters
       SET progress = ?, updated_at = datetime('now', '+9 hours')
       WHERE id = ? AND status = '進行中'`
    )
      .bind(progress, id)
      .run();

    if (!result.success || result.meta.changes === 0) {
      return json({ error: "not found or not in progress" }, 404);
    }

    return json({ ok: true, progress });
  } catch (e: any) {
    return json(
      { error: "update failed", detail: String(e?.message || e) },
      500
    );
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
