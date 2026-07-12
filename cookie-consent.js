// ============================================================
// FIZU — Consentimento de Cookies (LGPD)
// Cookies essenciais (sessão/login) sempre ativos. Cookies analíticos
// (Google Analytics) só carregam depois que a pessoa aceita explicitamente.
// A decisão fica salva em localStorage e nunca é assumida por padrão.
// ============================================================
(function () {
  var CHAVE = "fizu-cookie-consent"; // "accepted" | "rejected"
  var GA_ID = "G-LKTCXCMC6X";

  function carregarGA() {
    if (window._fizuGaCarregado) return;
    window._fizuGaCarregado = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_ID);
  }

  function mostrarBanner() {
    if (document.getElementById("fizu-cookie-banner")) return;
    var div = document.createElement("div");
    div.id = "fizu-cookie-banner";
    div.style.cssText =
      "position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:520px;" +
      "margin:0 auto;background:#0d1628;color:#eef4ff;border:1px solid rgba(59,158,255,.28);" +
      "border-radius:14px;padding:18px 20px;font-family:'DM Sans',sans-serif;font-size:.85rem;" +
      "line-height:1.55;box-shadow:0 10px 36px rgba(0,0,0,.4)";
    div.innerHTML =
      '<div style="margin-bottom:13px">🍪 Usamos cookies essenciais pra manter sua sessão, e — só com sua permissão — cookies analíticos pra entender como o Fizu é usado. Nunca vendemos seus dados. <a href="privacidade.html" style="color:#3b9eff;font-weight:600">Saiba mais</a>.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="fizu-cc-aceitar" style="background:#3b9eff;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;font-size:.82rem;cursor:pointer;font-family:inherit">Aceitar</button>' +
      '<button id="fizu-cc-recusar" style="background:none;border:1px solid rgba(59,158,255,.35);color:#eef4ff;border-radius:8px;padding:9px 18px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit">Só essenciais</button>' +
      "</div>";
    document.body.appendChild(div);

    document.getElementById("fizu-cc-aceitar").onclick = function () {
      localStorage.setItem(CHAVE, "accepted");
      div.remove();
      carregarGA();
    };
    document.getElementById("fizu-cc-recusar").onclick = function () {
      localStorage.setItem(CHAVE, "rejected");
      div.remove();
    };
  }

  var decisao = null;
  try { decisao = localStorage.getItem(CHAVE); } catch (e) {}

  if (decisao === "accepted") {
    carregarGA();
  } else if (decisao !== "rejected") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mostrarBanner);
    } else {
      mostrarBanner();
    }
  }
})();
