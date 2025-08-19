export const onRequest: PagesFunction<{ Bindings: { API: Fetcher } }> = async (ctx) => {
  // 元のメソッド/ヘッダ/ボディを維持して Worker に転送
  const url = new URL(ctx.request.url)
  const forward = new Request(url.pathname + url.search, {
    method: ctx.request.method,
    headers: ctx.request.headers,
    body: ctx.request.body
  })
  return ctx.env.API.fetch(forward)
}
