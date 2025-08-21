// functions/letter/[id].ts
type Env = { DB: D1Database };

const truncate = (s: string, n = 120) =>
  [...s.replace(/\s+/g, " ")].slice(0, n).join("") + (s.length > n ? "…" : "");

export const onRequestGet: PagesFunction<Env> = async ({
  env,
  params,
  request,
}) => {
  const id = Number((params as any).id);
  if (!id) return new Response("Not found", { status: 404 });

  // 投書とオーナー名を取得
  const row = await env.DB.prepare(
    `SELECT l.id, l.content, l.owner_id, o.display_name
       FROM letters l LEFT JOIN owners o ON o.id = l.owner_id
      WHERE l.id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      content: string;
      owner_id: string;
      display_name?: string;
    }>();

  if (!row) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/letter/${row.id}`; // このURLをツイートさせる
  const title = `${row.display_name ?? "@" + row.owner_id} さんへの投書`;
  const desc = truncate(row.content, 120);
  const ogImage = `${origin}/og-default.png`; // 1200x630 の画像を public/ に置く

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<link rel="canonical" href="${shareUrl}">
<meta name="viewport" content="width=device-width,initial-scale=1">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="投書箱">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${ogImage}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${ogImage}">

<meta http-equiv="refresh" content="0;url=/letter.html?id=${row.id}">
<title>${title}</title>
</head>
<body>
  <p><a href="/letter.html?id=${row.id}">投書ページを開く</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
