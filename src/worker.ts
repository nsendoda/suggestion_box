import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
  MAX_OWNERS?: string
  SIGNUPS_HARD_OFF?: string
}

const app = new Hono<{ Bindings: Bindings }>()

const normalizeId = (s: string) => s.trim().toLowerCase();

// -------- Password PBKDF2 (HMAC-SHA-256) --------
const te = new TextEncoder()
const b64 = (ab: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(ab)))
const b64dec = (s: string) =>
  new Uint8Array([...atob(s)].map(c => c.charCodeAt(0)))

async function hashPassword(password: string, saltB64?: string) {
  const salt = saltB64 ? b64dec(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', iterations: 100_000, salt },
    key,
    256
  )
  return { salt: b64(salt.buffer), hash: b64(bits) }
}
async function verifyPassword(password: string, salt: string, hash: string) {
  const h = await hashPassword(password, salt)
  return h.hash === hash
}

// -------- Session helpers --------
function newToken() {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function createSession(c: any, ownerId: string, days = 7) {
  const expires = Math.floor(Date.now() / 1000) + days * 86400
  const token = newToken()
  await c.env.DB.prepare(
    'INSERT INTO sessions(token, owner_id, expires_at) VALUES(?,?,?)'
  ).bind(token, ownerId, expires).run()
  setCookie(c, 'sb_session', token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: days * 86400,
  })
}
async function requireAuth(c: any, next: any) {
  const t = getCookie(c, 'sb_session')
  if (!t) return c.redirect('/login.html', 302)
  const row = await c.env.DB
    .prepare('SELECT owner_id, expires_at FROM sessions WHERE token=?')
    .bind(t).first<{ owner_id: string; expires_at: number }>()
  if (!row || row.expires_at < Math.floor(Date.now() / 1000)) {
    deleteCookie(c, 'sb_session', { path: '/' })
    return c.redirect('/login.html', 302)
  }
  c.set('ownerId', row.owner_id)
  await next()
}

// サインアップ（開放時のみ）
app.post('/api/signup', zValidator('json', z.object({
  ownerId: z.string().regex(/^[a-z0-9_-]{3,32}$/),  // 小文字のみを許可
  password: z.string().min(6),
  displayName: z.string().max(40).optional()
})), async (c) => {
  let { ownerId, password, displayName } = c.req.valid('json')
  ownerId = normalizeId(ownerId)

  const exists = await c.env.DB.prepare('SELECT 1 FROM owners WHERE id=?')
    .bind(ownerId).first()
  if (exists) return c.json({ error: 'duplicate' }, 409)

  const { salt, hash } = await hashPassword(password)
  await c.env.DB.prepare(
    'INSERT INTO owners(id, display_name, pw_salt, pw_hash, is_admin) ' +
    'VALUES(?,?,?,?, CASE WHEN (SELECT COUNT(*) FROM owners)=0 THEN 1 ELSE 0 END)'
  ).bind(ownerId, displayName ?? ownerId, salt, hash).run()

  await createSession(c, ownerId)
  return c.json({ ok: true })
})

app.post('/api/login', zValidator('json', z.object({
  ownerId: z.string(), password: z.string()
})), async (c) => {
  let { ownerId, password } = c.req.valid('json')
  ownerId = normalizeId(ownerId)

  const row = await c.env.DB.prepare(
    'SELECT pw_salt, pw_hash FROM owners WHERE id=?'
  ).bind(ownerId).first<{ pw_salt: string; pw_hash: string }>()

  if (!row) return c.json({ error: 'notfound' }, 404)
  if (!(await verifyPassword(password, row.pw_salt, row.pw_hash))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await createSession(c, ownerId)
  return c.json({ ok: true })
})

app.post('/api/logout', async (c) => {
  const t = getCookie(c, 'sb_session')
  if (t) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(t).run()
    deleteCookie(c, 'sb_session', { path: '/' })
  }
  return c.json({ ok: true })
})

app.get('/api/me', requireAuth, async (c) => {
  return c.json({ ownerId: c.get('ownerId') })
})


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
// 引く / 一覧 / ステータス更新（本人のみ）
function assertOwnerMatch(c: any, paramId: string) {
  if (c.get('ownerId') !== paramId) return c.json({ error: 'forbidden' }, 403)
}

app.post('/api/owners/:ownerId/draw', requireAuth, async (c) => {
  const { ownerId } = c.req.param()
  const res = assertOwnerMatch(c, ownerId); if (res) return res
  // keep_limit は owners.keep_limit を使う
  const kept = await c.env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM letters WHERE owner_id=? AND status="保持"'
  ).bind(ownerId).first<{ cnt:number }>()
  const limitRow = await c.env.DB.prepare(
    'SELECT keep_limit AS lim FROM owners WHERE id=?'
  ).bind(ownerId).first<{ lim:number }>()
  const lim = limitRow?.lim ?? 3
  if ((kept?.cnt ?? 0) >= lim) return c.json({ error: `Limit reached (${lim})` }, 409)
  // …以降は既存と同じ
})

app.get('/api/owners/:ownerId/letters', requireAuth, async (c) => {
  const { ownerId } = c.req.param()
  const res = assertOwnerMatch(c, ownerId); if (res) return res
  const showAll = c.req.query('all') === '1'
  const sql = showAll
    ? 'SELECT id, content, status, created_at, updated_at FROM letters WHERE owner_id=? ORDER BY updated_at DESC'
    : 'SELECT id, content, status, created_at, updated_at FROM letters WHERE owner_id=? AND status!="inbox" ORDER BY updated_at DESC'
  const { results } = await c.env.DB.prepare(sql).bind(ownerId).all()
  return c.json(results)
})

app.post('/api/owners/:ownerId/letters/:id/status', requireAuth, async (c) => {
  const { ownerId, id } = c.req.param()
  const res = assertOwnerMatch(c, ownerId); if (res) return res
  const { status } = await c.req.json() as { status: '完了'|'棄却'|'保持' }
  await c.env.DB.prepare(
    'UPDATE letters SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?'
  ).bind(status, id, ownerId).run()
  return c.json({ ok: true })
})

// 管理者だけ設定変更
app.post('/api/admin/signups', requireAuth, async (c) => {
  const me = c.get('ownerId') as string
  const admin = await c.env.DB.prepare('SELECT is_admin FROM owners WHERE id=?')
    .bind(me).first<{ is_admin: number }>()
  if (!admin || admin.is_admin !== 1) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json() as { enabled: boolean }
  await c.env.DB.prepare('INSERT INTO settings(key,value) VALUES("signups_enabled",?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(body.enabled ? '1' : '0').run()
  return c.json({ ok: true })
})

/* ---------- 静的ファイル (public/**) ---------- */
app.use('*', (c, next) => {
  return c.env.__STATIC_CONTENT_MANIFEST
    ? serveStatic({ root: './public' })(c, next) // dev 本番とも OK
    : next();                                    // dev 起動直後は次のルートへ
});

/* ---------- ESM 形式のエクスポート ---------- */
export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(req, env, ctx),
}