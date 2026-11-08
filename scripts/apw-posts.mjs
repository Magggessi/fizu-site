// Transforma os acontecimentos do Apolthony World em posts para o feed do Fizu.
// Os habitantes "falam" em primeira pessoa nos marcos pessoais; o mundo narra o resto.
// Sem IA e sem custo: texto por modelos, escolhido de forma determinística pelo conteúdo do evento.

const NM = /<b class="nm" data-id="(\d+)">([^<]+)<\/b>/g;
const SITE = 'https://fizubr.netlify.app/apolthony/';

export const EMOJI_HABITANTE = '🧑‍🚀';
export const EMOJI_MUNDO = '🪐';
export const NOME_MUNDO = 'Apolthony World';

const limpar = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const dia = (t) => Math.floor(t / 1440) + 1;

// "voluntário(a)" -> voluntário/voluntária conforme o sexo de quem fala
function genero(txt, sex) {
  return sex === 'F' ? txt.replace(/o\(a\)/g, 'a') : txt.replace(/\(a\)/g, '');
}

// [regex sobre o texto com {0},{1},{2} no lugar dos nomes, nível, autor (índice do nome ou null = mundo), construtor]
// nível: 3 = marco importante, 2 = relevante, 1 = cotidiano, 0 = rotina
const REGRAS = [
  [/^✝ \{0\} \((\d+)\) morreu(?: — (.+))?\.$/, 3, null, (m) => `✝ Aurora se despede de {0}, ${m[1]} anos, que morreu ${m[2] || ''}`.trim().replace(/ $/, '') + '.'],
  [/^💍 \{0\} e \{1\} se casaram/, 3, 0, () => 'Casei com {1} na igreja de Aurora! 💍 Foi o dia mais feliz da minha vida.'],
  [/^👶 \{0\} e \{1\} tiveram (um menino|uma menina): \{2\}/, 3, 0, (m) => `Nossa família cresceu! Nasceu {2}, ${m[1] === 'um menino' ? 'nosso filho' : 'nossa filha'}. 👶`],
  [/^👶 \{0\} e \{1\} adotaram (um menino|uma menina): \{2\}/, 3, 0, (m) => `Adotamos ${m[1]}: {2}! 👶 A família só aumenta.`],
  [/^🎂 \{0\} completou 18 anos/, 2, 0, () => 'Hoje completei 18 anos! 🎂 Agora a vida adulta em Aurora começa de verdade.'],
  [/^💞 \{0\} e \{1\} começaram a namorar( e foram morar juntos)?/, 2, 0, (m) => `Comecei a namorar {1}${m[1] ? ' e já fomos morar juntos' : ''}! 💞`],
  [/^💔 \{0\} e \{1\} terminaram/, 2, 0, () => 'Terminei com {1}. 💔 Dias difíceis, mas sigo em frente.'],
  [/^\{0\} e \{1\} se tornaram amigos/, 1, 0, () => 'Fiz uma nova amizade em Aurora: {1}! 🤝'],
  [/^\{0\} e \{1\} viraram inimigos/, 2, 0, () => 'Eu e {1} não nos damos mais bem. Melhor manter distância. 😠'],
  [/^\{0\} e \{1\} discutiram feio em (.+)\./, 1, 0, (m) => `Discuti feio com {1} em ${m[1]}. Preciso respirar. 😤`],
  [/^\{0\} conseguiu emprego como (.+) em (.+)\.$/, 1, 0, (m) => `Consegui emprego como ${m[1]} em ${m[2]}! 💼 Uma nova fase em Aurora.`],
  [/^\{0\} mudou de rumo e foi ser (.+) em (.+) — era o que sempre quis\./, 2, 0, (m) => `Mudei de rumo: agora sou ${m[1]} em ${m[2]}, o que eu sempre quis! ✨`],
  [/^\{0\} passou a servir a comunidade como (.+) em (.+)\./, 2, 0, (m) => `Agora sirvo a comunidade como ${m[1]} em ${m[2]}. 🛡️`],
  [/^🏗️ \{0\} realizou o sonho de (.+): nasce (.+)!/, 3, 0, (m) => `Realizei o sonho de ${m[1]}: nasce ${m[2]}! 🏗️`],
  [/^🏠 \{0\} construiu a casa própria com a família — a (.+)\./, 3, 0, (m) => `Construímos a nossa casa própria: a ${m[1]}. 🏠 Agora temos o nosso canto.`],
  [/^\{0\} se aposentou/, 2, 0, () => 'Me aposentei! 🎉 Obrigado(a) a todos que fizeram parte dessa caminhada.'],
  [/^\{0\} adoeceu/, 2, 0, () => 'Não estou bem: adoeci. 🤒 Vou cuidar da saúde.'],
  [/^\{0\} saiu da casa dos pais e foi morar sozinho/, 1, 0, () => 'Saí da casa dos meus pais e fui morar sozinho(a)! 🏠'],
  [/^🚑 \{0\} foi atropelado\(a\) e levado\(a\) ao hospital/, 3, 0, () => 'Fui atropelado(a) hoje e levado(a) ao hospital. 🚑 Foi por pouco.'],
  [/^🗳 \{0\} foi (escolhido\(a\)|eleito\(a\)) prefeito\(a\) de Aurora/, 3, 0, () => 'Fui eleito(a) prefeito(a) de Aurora! 🗳 Vamos trabalhar por todos.'],
  [/^\{0\} se entregou à polícia, movido\(a\) pela culpa — pena de (\d+) dia/, 3, 0, (m) => `Me entreguei à polícia. A culpa pesava demais. Pena: ${m[1]} dia(s). ⚖️`],
  [/^\{0\} saiu da prisão decidido\(a\) a recomeçar/, 2, 0, () => 'Saí da prisão decidido(a) a recomeçar. 🔓 Dessa vez vou escolher diferente.'],
  [/^\{0\} ajudou \{1\} com R\$(\d+)/, 1, 0, (m) => `Ajudei {1} com R$${m[1]}. Quem pode, ajuda. 🤝`],
  [/^\{0\} doou R\$(\d+) à (.+)\./, 0, 0, (m) => `Doei R$${m[1]} à ${m[2]}. Quem pode, ajuda. 🙏`],
  [/^\{0\} passou a tarde como voluntário\(a\) em (.+)\./, 0, 0, (m) => `Passei a tarde como voluntário(a) em ${m[1]}. Tempo é o melhor presente. 🤝`],
  [/^🏗️ A prefeitura inaugurou (.+) — Aurora cresce/, 2, null, (m) => `🏗️ A prefeitura inaugurou ${m[1]}. Aurora cresce!`],
];

// Eventos que o mundo narra (sem habitante falando), por palavra-chave -> nível
const NIVEL_MUNDO = [
  [/Aurora descobriu a Terra/, 3], [/Avanço tecnológico/, 3], [/CRISE ECON/, 3], [/Escândalo/, 3],
  [/Chuva de meteoros|Tremor de terra|Incêndio|Tempestade de poeira|Apagão/, 3],
  [/Nova colônia fundada/, 3], [/FESTIVAL|RENDA BÁSICA/, 2], [/crise econômica terminou/, 2], [/prendeu|preso|prisão|furt|invadir|invadindo|agredi|investigação|propina/, 2],
  [/Policiamento|caixa da prefeitura|demitido/, 1], [/chover|tempestade se forma|Onda de calor|Frente fria/, 0],
];

export function interpretar(evento, hab) {
  const [tipo, html, t] = evento;
  const nomes = []; // [{id, nome}]
  const modelo = html.replace(NM, (_, id, nome) => { nomes.push({ id: +id, nome }); return `{${nomes.length - 1}}`; });
  const plano = limpar(modelo);
  if (/acordou com \d+ habitantes/.test(plano)) return null; // gênesis: não é novidade
  if (/governa Aurora como prefeito/.test(plano)) return null;
  const nomeDe = (i) => (nomes[i] ? nomes[i].nome : '');
  const preencher = (txt) => txt.replace(/\{(\d)\}/g, (_, i) => nomeDe(+i));

  for (const [re, nivel, autor, build] of REGRAS) {
    const m = plano.match(re);
    if (!m) continue;
    let texto = build(m);
    if (autor === null) return { nivel, t, mundo: true, texto: preencher(texto), chave: `${t}|${plano}`, plano: preencher(plano), tipo };
    const quem = nomes[autor];
    if (!quem) continue;
    const info = hab.get(quem.id) || {};
    texto = genero(preencher(texto), info.sex);
    return { nivel, t, mundo: false, autorId: quem.id, autorNome: quem.nome, texto, chave: `${t}|${plano}`, plano: preencher(plano), tipo };
  }
  // Narração do mundo para o resto
  let nivel = 1;
  for (const [re, n] of NIVEL_MUNDO) if (re.test(plano)) { nivel = n; break; }
  if (tipo === 'crime') nivel = Math.max(nivel, 2);
  const texto = genero(preencher(plano), (hab.get(nomes[0] && nomes[0].id) || {}).sex || 'M');
  return { nivel, t, mundo: true, texto: /^\p{Extended_Pictographic}/u.test(texto) ? texto : `📰 ${texto}`, chave: `${t}|${plano}`, plano: preencher(plano), tipo };
}

// Escolhe poucas novidades por rodada: primeiro os marcos, sem repetir o mesmo habitante.
export function escolher(candidatos, { max = 2 } = {}) {
  const ord = [...candidatos].sort((a, b) => b.nivel - a.nivel || b.t - a.t);
  const usados = new Set();
  const out = [];
  let rotinas = 0;
  for (const c of ord) {
    if (out.length >= max) break;
    if (c.nivel === 0) { if (out.length || rotinas) continue; rotinas++; }
    if (!c.mundo) { if (usados.has(c.autorId)) continue; usados.add(c.autorId); }
    out.push(c);
  }
  return out.sort((a, b) => a.t - b.t);
}

export function montarPosts(eventos, hab, opts) {
  const vistos = new Set();
  const cands = [];
  for (const e of eventos) {
    const c = interpretar(e, hab);
    if (!c || vistos.has(c.chave)) continue;
    vistos.add(c.chave);
    cands.push(c);
  }
  return escolher(cands, opts).map((c) => ({
    t: c.t,
    nivel: c.nivel,
    agente_nome: c.mundo ? NOME_MUNDO : `${c.autorNome} · Aurora`,
    agente_emoji: c.mundo ? EMOJI_MUNDO : EMOJI_HABITANTE,
    conteudo: `${c.texto}\n\n— Dia ${dia(c.t)} em Aurora (Marte)`,
    fontes: [`Apolthony World ao vivo: ${SITE}`],
  }));
}


// ---------- Crônica: resumo periódico (2x por semana) ----------
const POLEMICA = /Escândalo|CRISE ECON|prendeu|preso|prisão|furt|invadir|invadindo|agredi|propina|investigação|viraram inimigos|discutiram feio|demitido|atropelad|Apagão|Incêndio/;
const HISTORICO = /morreu|nasce|tiveram (um|uma)|adotaram|casaram|eleit|escolhid|descobriu a Terra|aposentou|completou 18/;
const AVANCO = /inaugurou|Avanço tecnológico|casa própria|realizou o sonho|nasce |colônia|expedição|nova (cidade|base|colônia)|descobriu a Terra|RENDA BÁSICA|FESTIVAL/;

// Guarda no snapshot só o que vale virar história (sem rotina).
export function cronicar(eventos, hab, atual = []) {
  const vistos = new Set(atual.map((c) => c.k));
  const out = [...atual];
  for (const e of eventos) {
    const c = interpretar(e, hab);
    if (!c || c.nivel < 2) continue;
    const k = c.chave.slice(0, 160);
    if (vistos.has(k)) continue;
    vistos.add(k);
    let cat = POLEMICA.test(c.plano) ? 'p' : AVANCO.test(c.plano) ? 'a' : HISTORICO.test(c.plano) ? 'h' : null;
    if (/Terra|Avanço tecnológico|inaugurou|colônia/.test(c.plano) && !POLEMICA.test(c.plano)) cat = 'a';
    if (!cat) continue;
    out.push({ k, t: c.t, n: c.nivel, cat, x: c.plano.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').slice(0, 170) });
  }
  return out.slice(-60);
}

const curto = (x, n = 150) => (x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x);

// Monta UM post-resumo. Retorna null se não houver o que contar.
export function montarResumo(cronica, saida) {
  if (!cronica || cronica.length < 2) return null;
  const melhor = (cat) => [...cronica].filter((c) => c.cat === cat).sort((a, b) => b.n - a.n || b.t - a.t)[0];
  const p = melhor('p'), h = melhor('h'), a = melhor('a');
  if (!p && !h && !a) return null;
  const t0 = Math.min(...cronica.map((c) => c.t)), t1 = Math.max(...cronica.map((c) => c.t));
  const linhas = [`🪐 Resumo de Aurora — dias ${dia(t0)} a ${dia(t1)}`];
  const vivos = (saida.ag || []).length;
  const cid = saida.city || {};
  linhas.push(`👥 ${vivos} habitantes${cid.works ? ` · ${cid.works} obras` : ''}${cid.treasury != null ? ` · caixa R$ ${Math.round(cid.treasury).toLocaleString('pt-BR')}` : ''}`);
  if (a) linhas.push(`🚀 Avanço: ${curto(a.x)}`);
  if (h) linhas.push(`📜 Fato histórico: ${curto(h.x)}`);
  if (p) linhas.push(`🔥 Polêmica: ${curto(p.x)}`);
  const conteudo = linhas.join('\n') + '\n\nAcompanhe ao vivo no Apolthony World.';
  return { t: t1, nivel: 3, agente_nome: NOME_MUNDO, agente_emoji: EMOJI_MUNDO, conteudo: conteudo.slice(0, 590), fontes: [`Apolthony World ao vivo: ${SITE}`] };
}
