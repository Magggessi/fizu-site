// Netlify Edge Function — SSR de meta tags OG para /post/:id
// Executada no edge ANTES do redirect, garante que bots (WhatsApp, Telegram, Google)
// recebam HTML com as tags já preenchidas no servidor.

import type { Context } from "https://edge.netlify.com";

const SUPA_URL = "https://tnwildfshzrvktrlfjhz.supabase.co";
const SUPA_KEY = "sb_publishable_wGUZQpVa2MWcpC2gupBC4Q_JrtWFeKN";

// Detecta se o request vem de um bot/scraper de OG
function isBot(ua: string): boolean {
  const bots = [
    "whatsapp","telegram","twitterbot","facebookexternalhit",
    "linkedinbot","slackbot","discordbot","googlebot","bingbot",
    "applebot","embedly","outbrain","pinterest","quora",
    "vkshare","w3c_validator","curl","wget","python-requests",
  ];
  const lower = ua.toLowerCase();
  return bots.some(b => lower.includes(b));
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" });
  } catch { return ""; }
}

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /post/:id
  const postId = parts[1];

  if (!postId || postId.length < 10) return context.next();

  const ua = req.headers.get("user-agent") || "";

  // Browsers normais: deixa passar para o post.html (JS faz o trabalho)
  if (!isBot(ua)) return context.next();

  // Bot detectado — faz SSR das meta tags
  try {
    const [postRes, ] = await Promise.all([
      fetch(`${SUPA_URL}/rest/v1/posts?id=eq.${postId}&select=conteudo,autor_id,criado_em,midia_url,curtidas_count,comentarios_count&limit=1`, {
        headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` }
      })
    ]);

    const posts = await postRes.json();
    const post = Array.isArray(posts) ? posts[0] : null;

    if (!post) return context.next();

    // Busca perfil do autor
    const perfilRes = await fetch(
      `${SUPA_URL}/rest/v1/perfis?id=eq.${post.autor_id}&select=nome,foto_url&limit=1`,
      { headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` } }
    );
    const perfis = await perfilRes.json();
    const perfil = Array.isArray(perfis) ? perfis[0] : null;

    const nome    = esc(perfil?.nome || "Usuário Fizu");
    const conteudo = post.conteudo || "";
    const preview  = esc(conteudo.substring(0, 200).replace(/\n/g, " "));
    const previewCurto = esc(conteudo.substring(0, 80).replace(/\n/g, " "));
    const data    = post.criado_em ? esc(fmt(post.criado_em)) : "";
    const img     = post.midia_url || "https://fizu.com.br/og-image.png";
    const postUrl = `https://fizu.com.br/post/${postId}`;
    const feedUrl = `https://fizu.com.br/feed.html#post-${postId}`;

    const titulo  = `${nome}: "${previewCurto}${conteudo.length > 80 ? "…" : ""}"`;
    const desc    = `${preview}${conteudo.length > 200 ? "…" : ""} — No Fizu, o que você diz fica para sempre. 🐟`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
<meta name="description" content="${esc(desc)}">

<!-- Open Graph — lido por WhatsApp, Telegram, Facebook, LinkedIn -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="Fizu">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${postUrl}">
${data ? `<meta property="article:published_time" content="${post.criado_em}">` : ""}
<meta property="article:author" content="${esc(perfil?.nome || "Fizu")}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@fizurede">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">

<!-- Redirect imediato para a página real (com JS) -->
<meta http-equiv="refresh" content="0;url=${feedUrl}">
<link rel="canonical" href="${postUrl}">
</head>
<body style="background:#080c14;color:#eef4ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box">
  <div style="text-align:center;max-width:480px">
    <div style="font-size:2rem;margin-bottom:12px">🐟</div>
    <div style="font-size:1rem;font-weight:700;margin-bottom:6px">${esc(titulo)}</div>
    <div style="font-size:.85rem;color:#6b8aad;margin-bottom:20px">${esc(desc.substring(0,120))}…</div>
    <a href="${feedUrl}" style="background:#3b9eff;color:#fff;padding:11px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:.9rem">
      Ver no Fizu →
    </a>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (e) {
    // Qualquer erro: deixa passar para o post.html normal
    return context.next();
  }
}

export const config = { path: "/post/:id" };
