import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'  // Hono 公式の静的配信


type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Env }>()

/* ---------- 1. 一般ユーザー：投書送信 ---------- */
app.post(
  '/api/owners/:ownerId/letters',
  zValidator(
    'json',
    z.object({
      content: z.string().max(200),
    })
  ),
  async (c) => {
    const { ownerId } = c.req.param()
    const { content } = c.req.valid('json')

    await c.env.DB.prepare(
      'INSERT INTO letters (owner_id, content) VALUES (?, ?)'
    )
      .bind(ownerId, content)
      .run()

    return c.json({ ok: true })
  }
)

/* ---------- 2. オーナー：投書を引く ---------- */
app.post('/api/owners/:ownerId/draw', async (c) => {
  const { ownerId } = c.req.param()

  // 2-1. 保持枚数を確認
  const keptCountRes = await c.env.DB.prepare(
    'SELECT count(*) AS cnt FROM letters WHERE owner_id=? AND status="保持"'
  )
    .bind(ownerId)
    .first<{ cnt: number }>()

  if ((keptCountRes?.cnt ?? 0) >= 3) {
    return c.json({ error: 'Limit reached (3 kept)' }, 409)
  }

  // 2-2. inbox からランダムに 1 枚取得
  const inboxRes = await c.env.DB.prepare(
    'SELECT id, content FROM letters WHERE owner_id=? AND status="inbox" ORDER BY random() LIMIT 1'
  )
    .bind(ownerId)
    .first<{ id: number; content: string }>()

  if (!inboxRes) return c.json({ error: 'No letters in inbox' }, 404)

  // 2-3. 状態を「保持」に変更
  await c.env.DB.prepare(
    'UPDATE letters SET status="保持", updated_at=CURRENT_TIMESTAMP WHERE id=?'
  )
    .bind(inboxRes.id)
    .run()

  return c.json({ id: inboxRes.id, content: inboxRes.content })
})

/* ---------- 3. オーナー：一覧取得 ---------- */
app.get('/api/owners/:ownerId/letters', async (c) => {
  const { ownerId } = c.req.param()

  const rows = await c.env.DB.prepare(
    'SELECT id, content, status, created_at, updated_at FROM letters WHERE owner_id=? AND status!="inbox" ORDER BY updated_at DESC'
  )
    .bind(ownerId)
    .all()

  return c.json(rows)
})

/* ---------- 4. オーナー：ステータス更新 (完了／棄却) ---------- */
app.post(
  '/api/owners/:ownerId/letters/:id/status',
  zValidator(
    'json',
    z.object({
      status: z.enum(['完了', '棄却']),
    })
  ),
  async (c) => {
    const { id } = c.req.param()
    const { status } = c.req.valid('json')

    await c.env.DB.prepare(
      'UPDATE letters SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    )
      .bind(status, id)
      .run()

    return c.json({ ok: true })
  }
)

/* ---------- 静的ファイル (public/**) ---------- */
app.use('*', serveStatic({ root: './public' }))

/* ---------- ESM 形式のエクスポート ---------- */
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(req, env, ctx),
}