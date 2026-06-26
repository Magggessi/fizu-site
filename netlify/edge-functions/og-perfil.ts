// Netlify Edge Function — SSR de meta tags OG para /u/:id

import type { Context } from "https://edge.netlify.com";

const SUPA_URL = "https://tnwildfshzrvktrlfjhz.supabase.co";
const SUPA_KEY = "sb_publishable_wGUZQpVa2MWcpC2gupBC4Q_JrtWFeKN";

function isBot(ua: string): boolean {
  const bots = [
    "whatsapp","telegram","twitterbot","facebookexternalhit",
    "linkedinbot","slackbot","discordbot","googlebot","bingbot",
    "applebot","embedly","outbrain","pinterest","quora","curl","wget",
  ];
  return bots.some(b => ua.toLowerCase().includes(b));
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const userId = parts[1];

  if (!userId || userId.length < 10) return context.next();

  const ua = req.headers.get("user-agent") || "";
  if (!isBot(ua)) return context.next();

  try {
    const perfilRes = await fetch(
      `${SUPA_URL}/rest/v1/perfis?id=eq.${userId}&select=nome,foto_url,biografia,seguidores_count,streak_atual&limit=1`,
      { headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` } }
    );
    const perfis = await perfilRes.json();
    const p = Array.isArray(perfis) ? perfis[0] : null;
    if (!p) return context.next();

    const nome    = esc(p.nome || "Usuário Fizu");
    const bio     = esc(p.biografia || `Perfil de ${p.nome} na rede da verdade permanente.`);
    const img     = p.foto_url || "https://fizu.com.br/og-image.png";
    const profileUrl = `https://fizu.com.br/u/${userId}`;
    const feedUrl    = `https://fizu.com.br/feed.html`;
    const titulo  = `${nome} no Fizu`;
    const desc    = `${bio} · ${p.seguidores_count || 0} seguidores · ${p.streak_atual || 0} dias de streak 🔥`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Fizu">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${profileUrl}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${feedUrl}">
<link rel="canonical" href="${profileUrl}">
</head>
<body style="background:#080c14;color:#eef4ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box">
  <div style="text-align:center">
    <div style="font-size:2rem;margin-bottom:8px">🐟</div>
    <div style="font-weight:700;margin-bottom:4px">${esc(nome)}</div>
    <div style="font-size:.85rem;color:#6b8aad;margin-bottom:16px">${esc(p.biografia?.substring(0,80) || "")}</div>
    <a href="${feedUrl}" style="background:#3b9eff;color:#fff;padding:10px 24px;border-radius:10px;text-decoration:none;font-weight:700">Ver no Fizu →</a>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });

  } catch {
    return context.next();
  }
}

export const config = { path: "/u/:id" };
