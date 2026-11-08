// Relógio mestre do Apolthony World.
// Carrega o mundo oficial (Supabase) num Chrome sem tela, avança o tempo até "agora"
// (1 tick = 250 ms de tempo real = 4x) e grava o novo estado. Se não existir mundo, cria o gênesis.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { montarPosts } from './apw-posts.mjs';

const MODS = process.env.APW_MODULES || process.cwd();
const req = createRequire(path.join(MODS, 'x.js'));
const { chromium } = req('playwright-core');
const THREE_DIR = path.join(MODS, 'node_modules', 'three');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnwildfshzrvktrlfjhz.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wGUZQpVa2MWcpC2gupBC4Q_JrtWFeKN';
const TOKEN = process.env.APW_RUNNER_TOKEN || '';
const DRY = process.env.APW_DRY === '1';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const MS_PER_TICK = 250;
const SEED = 20261108;
const MAX_POSTS_POR_RODADA = 2; // o servidor ainda limita por hora
const MAX_TICKS = 200000; // ~14 h de tempo real de uma vez, em lotes
const html = fs.readFileSync(new URL('../apolthony/index.html', import.meta.url), 'utf8');

async function lerSnapshot() {
  if (process.env.APW_SNAPSHOT_FILE) { const txt = fs.readFileSync(process.env.APW_SNAPSHOT_FILE, 'utf8').trim(); return txt ? JSON.parse(txt) : null; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/apw_mundo?id=eq.1&select=snapshot`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!r.ok) throw new Error('leitura falhou: ' + r.status);
  const rows = await r.json();
  return rows[0] ? JSON.parse(rows[0].snapshot) : null;
}

async function main() {
  const snap = await lerSnapshot();
  const agora = Date.now();
  let ticks = 0;
  if (snap) ticks = Math.max(0, Math.min(MAX_TICKS, Math.floor((agora - snap.saved) / MS_PER_TICK)));
  if (process.env.APW_FORCE_TICKS) ticks = +process.env.APW_FORCE_TICKS; // só para testes
  console.log(snap ? `mundo existente: t=${snap.t}, avançar ${ticks} ticks` : 'sem mundo: criando gênesis');

  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
  await ctx.addInitScript(({ snap, seed }) => { window.__APW_SAVE = snap; window.__APW_SEED = seed; }, { snap, seed: SEED });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.route('http://apw.local/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => {
    const rel = new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    const f = path.join(THREE_DIR, rel);
    return fs.existsSync(f) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.continue();
  });
  await page.goto('http://apw.local/apolthony/?runner=1');
  await page.waitForFunction(() => window.__APW_API, null, { timeout: 180000 });

  const t0 = await page.evaluate(() => window.__APW_API.t);
  // Acontecimentos novos (ainda não vistos): o feed interno guarda só os últimos 400, então lemos em lotes pequenos.
  const vistos = new Set((snap?.feed || []).map(([, h, t]) => `${t}|${h}`));
  const eventos = [];
  for (let feito = 0; feito < ticks; ) {
    const n = Math.min(250, ticks - feito);
    const lote = await page.evaluate(n => { for (let i = 0; i < n; i++) window.__APW_API.tick(); return window.__APW_API.feed.slice(0, 120).map(a => [a.type, a.html, a.t]); }, n);
    for (const e of lote) { const k = `${e[2]}|${e[1]}`; if (!vistos.has(k)) { vistos.add(k); eventos.push(e); } }
    feito += n;
  }
  const saida = JSON.parse(await page.evaluate(() => window.__APW_API.save()));
  await browser.close();

  // Habitantes postam as próprias novidades no feed do Fizu (o servidor aplica o limite por hora).
  const hab = new Map((saida.ag || []).map(a => [a.id, { sex: a.sex }]));
  const posts = snap ? montarPosts(eventos, hab, { max: MAX_POSTS_POR_RODADA }) : [];
  console.log(`acontecimentos novos: ${eventos.length} | posts para o feed: ${posts.length}`);
  for (const p of posts) console.log(`  [${p.nivel}] ${p.agente_nome}: ${p.conteudo.split('\n')[0]}`);

  saida.saved = snap ? snap.saved + ticks * MS_PER_TICK : agora; // relógio contínuo, sem deriva
  const corpo = JSON.stringify(saida);
  console.log(`t: ${t0} -> ${saida.t} | habitantes: ${saida.ag.length} | ${(corpo.length / 1024).toFixed(0)} KB`);
  if (process.env.APW_OUT) fs.writeFileSync(process.env.APW_OUT, corpo);
  if (DRY) { console.log('APW_DRY=1: não enviado'); return; }
  if (!TOKEN) throw new Error('APW_RUNNER_TOKEN ausente');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/apw-mundo-salvar`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-runner-token': TOKEN }, body: JSON.stringify({ snapshot: corpo, t: saida.t, saved: saida.saved, posts }) });
  console.log('upload:', r.status, await r.text());
  if (!r.ok) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
