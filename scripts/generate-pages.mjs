// scripts/generate-pages.mjs
import fs from "fs";
import path from "path";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const SOCIAL = {
  instagram: "https://www.instagram.com/di_corporation_1/",
  tiktok: "https://www.tiktok.com/@dicorporation",
  telegram: "https://t.me/Viralflowr",
  waba: "https://wa.me/243850373991",
};

// ---------- helpers ----------
const safe = (v) => (v === null || v === undefined ? "" : String(v));

const escHtml = (s) =>
  safe(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function toDirectOGImage(url) {
  const u = safe(url).trim();
  if (!u) return "";

  if (u.includes("lh3.googleusercontent.com/d/")) {
    return u.includes("=") ? u : `${u}=w1200`;
  }

  const m1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1?.[1]) return `https://lh3.googleusercontent.com/d/${m1[1]}=w1200`;

  const m2 = u.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2?.[1]) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;

  if (/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(u)) return u;

  return u;
}

function ogFallback() {
  return "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
}

// Paiement: utilise desc (paiement.html)
function buildPayUrl(p, prixOverride = null) {
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(prixOverride !== null ? prixOverride : p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id", safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("img", safe(p.img || ""));
  qp.set("desc", safe(p.desc || "").trim());
  return `/paiement.html?${qp.toString()}`;
}

/**
 * FETCH PRODUCTS (JSONP)
 */
async function fetchProducts() {
  const cb = "cb";
  const url = `${SCRIPT_URL}?action=get_products&callback=${cb}&t=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json,text/javascript,*/*" },
  });

  const txt = await res.text();

  const preview = (s, n = 240) => {
    const v = safe(s);
    return v.length > n ? v.slice(0, n) + "…" : v;
  };

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} • Aperçu: ${preview(txt)}`);
  }

  const re = new RegExp(`${cb}\\((.*)\\)\\s*;?\\s*$`, "s");
  const m = txt.match(re);

  let jsonText = "";
  if (m && m[1]) {
    jsonText = m[1].trim();
  } else {
    const trimmed = txt.trim();
    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));

    if (!looksLikeJson) {
      throw new Error(`Réponse JSONP invalide. Aperçu: ${preview(txt)}`);
    }
    jsonText = trimmed;
  }

  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`JSON invalide. Aperçu: ${preview(jsonText)}`);
  }

  const list =
    Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.products)
      ? payload.products
      : payload && Array.isArray(payload.items)
      ? payload.items
      : payload && Array.isArray(payload.data)
      ? payload.data
      : payload?.data && Array.isArray(payload.data.products)
      ? payload.data.products
      : payload?.data && Array.isArray(payload.data.items)
      ? payload.data.items
      : payload?.result && Array.isArray(payload.result)
      ? payload.result
      : payload?.results && Array.isArray(payload.results)
      ? payload.results
      : null;

  if (!list) {
    const keys = payload && typeof payload === "object" ? Object.keys(payload) : [];
    const msg = safe(payload?.message) || safe(payload?.error) || safe(payload?.status) || "";
    throw new Error(`Le endpoint ne renvoie pas une liste. Keys=${keys.length ? keys.join(", ") : "N/A"}${msg ? " • " + msg : ""}`);
  }

  return list;
}

// ---------- SVG snippets ----------
const SVG = {
  home: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11l9-8 9 8"></path>
    <path d="M9 22V12h6v10"></path>
  </svg>`,
  orders: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 6h11"></path>
    <path d="M9 12h11"></path>
    <path d="M9 18h11"></path>
    <path d="M4 6h.01"></path>
    <path d="M4 12h.01"></path>
    <path d="M4 18h.01"></path>
  </svg>`,
  wallet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
    <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
    <path d="M20 12h-4a2 2 0 0 0 0 4h4"/>
    <circle cx="16" cy="14" r="0.5" />
  </svg>`,
  login: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
    <path d="M10 17l5-5-5-5"></path>
    <path d="M15 12H3"></path>
  </svg>`,
  register: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <path d="M20 8v6"></path>
    <path d="M23 11h-6"></path>
  </svg>`,
  instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
    <path d="M16 11.37a4 4 0 1 1-7.87 1.26 4 4 0 0 1 7.87-1.26z"></path>
    <path d="M17.5 6.5h.01"></path>
  </svg>`,
  tiktok: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.7 7.4c-1-1-1.6-2.3-1.7-3.7h-3v12c0 1.3-1 2.3-2.3 2.3-1.2 0-2.2-1-2.2-2.2 0-1.3 1-2.3 2.2-2.3.3 0 .6.1.9.2V9.3c-.3-.1-.6-.1-.9-.1C6.6 9.2 4 11.8 4 15c0 3.2 2.6 5.8 5.8 5.8 3.2 0 5.8-2.6 5.8-5.8V11c1.1.8 2.4 1.2 3.8 1.2V9.3c-1.1 0-2.2-.4-3-.9z"/>
  </svg>`,
  telegram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.9 15.6 9.7 19c.4 0 .6-.2.8-.4l1.9-1.8 4 2.9c.7.4 1.2.2 1.4-.7l2.6-12.1c.3-1.2-.4-1.7-1.2-1.4L3.6 10.3c-1.1.4-1.1 1.1-.2 1.4l4 1.2 9.2-5.8c.4-.3.8-.1.5.2z"/>
  </svg>`,
  whatsapp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
  </svg>`,
};

function numOrInfinity(v) {
  const s = safe(v).trim();
  if (!s) return "";
  return s;
}

// ---------- templates ----------
function templateProductPage(p) {
  const id = safe(p.id).trim();
  const nom = safe(p.nom).trim() || `Produit ${id}`;
  const cat = safe(p.cat).trim() || "Catalogue";

  // prix statique (client) -> sera remplacé dynamiquement si token
  const prixClient = safe(p.prix).trim() || "0";

  const imgRaw = safe(p.img).trim();
  const ogImg = toDirectOGImage(imgRaw) || ogFallback();

  const longDesc = safe(p.long_desc).trim();
  const payUrlClient = buildPayUrl(p, prixClient);

  const ogDesc = `${prixClient} $ • ${cat}${longDesc ? " • " + longDesc.replace(/\s+/g, " ").slice(0, 120) : ""}`.slice(0, 200);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: nom,
    image: [ogImg],
    description: longDesc || `${cat} • ${prixClient}$`,
    brand: { "@type": "Brand", name: "ViralFlowr" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: String(prixClient).replace(",", "."),
      availability: "https://schema.org/InStock",
      url: `https://viralflowr.com/p/${encodeURIComponent(id)}/`,
    },
  };

  const minTxt = numOrInfinity(p.min) || "1";
  const maxTxt = numOrInfinity(p.max) || "∞";

  const JS_SVG_LOGIN = JSON.stringify(SVG.login);
  const JS_SVG_REGISTER = JSON.stringify(SVG.register);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escHtml(nom)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(ogDesc)}">
  <link rel="canonical" href="https://viralflowr.com/p/${encodeURIComponent(id)}/">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(nom)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImg)}">
  <meta property="og:url" content="https://viralflowr.com/p/${encodeURIComponent(id)}/">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(ogImg)}">

  <script type="application/ld+json">${escHtml(JSON.stringify(jsonLd))}</script>

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    html, body { width:100%; max-width:100%; overflow-x:hidden; }
    *{ box-sizing:border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background-color: #F3F3F3;
      color: #201B16;
      -webkit-text-size-adjust: 100%;
      padding-bottom: env(safe-area-inset-bottom);
      overscroll-behavior-x: none;
    }
    .no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
    .no-scrollbar::-webkit-scrollbar{ display:none; }

    .text-orange-bsv { color: #F07E13; }
    .btn-gradient { background: linear-gradient(90deg, #F07E13 0%, #FFB26B 100%); }
    .shadow-card { box-shadow: 0 0 7px 0 rgba(0,0,0,.15); }

    .btn-mini{
      height:40px; padding:0 14px; border-radius:999px;
      font-weight:900; font-size:11px; letter-spacing:.10em;
      text-transform:uppercase;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:1px solid #E5E7EB; background:#fff; color:#111827;
      transition:.2s; white-space:nowrap; flex:0 0 auto;
      max-width:100%;
    }
    .btn-mini:hover{ transform: translateY(-1px); border-color:#F07E13; color:#F07E13; }

    .btn-waba{
      height:40px; padding:0 14px; border-radius:999px;
      font-weight:900; font-size:11px; letter-spacing:.10em;
      text-transform:uppercase;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:1px solid rgba(37,211,102,.25);
      background:#25D366; color:#fff;
      transition:.2s; white-space:nowrap; flex:0 0 auto;
      max-width:100%;
    }
    .icon-btn{
      width:40px; height:40px; border-radius:999px;
      border:1px solid #E5E7EB; background:#fff; color:#374151;
      display:flex; align-items:center; justify-content:center;
      transition:.2s; flex:0 0 auto;
    }
    .vf-brand-wrap{ min-width:0; overflow:hidden; }
    .vf-brand-text{
      display:block; max-width:100%;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      line-height:1;
    }

    @media (max-width: 420px){
      .btn-mini, .btn-waba{ padding:0 10px; font-size:10px; letter-spacing:.08em; }
      .btn-mini .txt, .btn-waba .txt{ display:none; }
      .icon-btn{ width:36px; height:36px; }
    }
  </style>
</head>

<body class="flex flex-col min-h-screen">

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-200 shadow-sm">
    <div class="max-w-[1240px] mx-auto h-16 px-4 flex items-center justify-between gap-3">
      <a class="flex items-center gap-2 shrink-0 vf-brand-wrap" href="/index.html" aria-label="Boutique ViralFlowr">
        <div class="text-2xl font-black tracking-tighter vf-brand-text">
          Viral<span class="text-orange-bsv">Flowr</span>
        </div>
      </a>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
        <div id="accountArea" class="hidden sm:flex items-center gap-2"></div>

        <a class="icon-btn" href="/commandes.html" title="Mes commandes" aria-label="Mes commandes">${SVG.orders}</a>
        <a class="icon-btn" href="/wallet.html" title="Portefeuille" aria-label="Portefeuille">${SVG.wallet}</a>

        <a class="hidden sm:flex icon-btn" href="${escHtml(SOCIAL.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          ${SVG.instagram}
        </a>
        <a class="hidden sm:flex icon-btn" href="${escHtml(SOCIAL.tiktok)}" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
          ${SVG.tiktok}
        </a>
        <a class="hidden sm:flex icon-btn" href="${escHtml(SOCIAL.telegram)}" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
          ${SVG.telegram}
        </a>

        <a href="/index.html" class="btn-mini" aria-label="Boutique">
          ${SVG.home}
          <span class="txt">Boutique</span>
        </a>

        <a href="${escHtml(SOCIAL.waba)}" target="_blank" rel="noopener noreferrer" class="btn-waba" aria-label="WABA WhatsApp">
          ${SVG.whatsapp}
          <span class="txt">WABA</span>
        </a>
      </div>
    </div>
  </header>

  <main class="flex-1 mt-6 lg:mt-10 mb-20">
    <div class="max-w-[1240px] mx-auto px-3 md:px-4 flex flex-col gap-6">

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        <div class="flex flex-col gap-6">
          <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 md:p-8">
            <h1 class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">${escHtml(nom)}</h1>

            <div class="flex flex-col sm:flex-row gap-6">
              <div class="shrink-0">
                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                  <img src="${escHtml(imgRaw || ogImg)}" class="w-full h-full object-contain"
                       onerror="this.src='${escHtml(ogFallback())}'"
                       alt="${escHtml(nom)}">
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                <div class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium break-words">
                  ${escHtml(longDesc || "Aucune description.")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="flex flex-col gap-4">
          <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-6">
            <div class="grid grid-cols-2 gap-4 items-end">
              <div>
                <span class="text-gray-500 text-xs font-medium block mb-1">Prix Total:</span>
                <span id="priceValue" class="text-3xl font-black text-[#201B16] tracking-tighter">${escHtml(prixClient)} $</span>
              </div>
              <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                <span>Min : <strong class="text-gray-700">${escHtml(minTxt)}</strong></span>
                <span>Max : <strong class="text-gray-700">${escHtml(maxTxt)}</strong></span>
              </div>
            </div>

            <a id="buyBtn" href="${escHtml(payUrlClient)}"
               class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center">
              Acheter maintenant
            </a>

            <a href="${escHtml(SOCIAL.waba)}" target="_blank" rel="noopener noreferrer"
               class="w-full h-12 rounded-full bg-[#25D366] text-white font-black text-[13px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
              ${SVG.whatsapp}
              Contacter WABA
            </a>

            <a href="/share/${encodeURIComponent(id)}/"
               class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold hover:text-orange-500 transition-colors">
              Partager ce produit
            </a>
          </div>

          <a href="/index.html"
             class="bg-white border border-gray-200 shadow-card rounded-xl p-4 flex items-center justify-center gap-2 text-gray-600 font-black uppercase text-[12px] hover:text-orange-600 hover:border-orange-200 transition">
            ${SVG.home}
            Retour Boutique
          </a>
        </aside>

      </div>
    </div>
  </main>

  <footer class="mt-auto bg-white border-t border-gray-200">
    <div class="max-w-[1240px] mx-auto px-4 py-10">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div class="text-xl font-black tracking-tighter">
          Viral<span class="text-orange-bsv">Flowr</span>
        </div>
      </div>

      <div class="mt-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        © 2026 ViralFlowr • Paiement sécurisé • Livraison digitale
      </div>
    </div>
  </footer>

  <!-- Account UI -->
  <script>
    const _VF_SVG_LOGIN = ${JS_SVG_LOGIN};
    const _VF_SVG_REGISTER = ${JS_SVG_REGISTER};

    function _vfSafe(v){ return (v === null || v === undefined) ? "" : String(v); }

    function getSession_(){
      try{
        const raw = localStorage.getItem("vf_session");
        if(!raw) return null;
        const s = JSON.parse(raw);
        if(!s || (!s.email && !s.username)) return null;
        return s;
      }catch(e){ return null; }
    }

    window.addEventListener("storage", (e) => {
      if (e.key === "vf_session") renderAccountUI_();
    });

    function renderAccountUI_(){
      const area = document.getElementById("accountArea");
      if(!area) return;

      const s = getSession_();
      area.innerHTML = "";
      area.classList.remove("hidden");

      if(!s){
        area.innerHTML =
          '<a href="/login.html" class="btn-mini" aria-label="Connexion">' +
            _VF_SVG_LOGIN +
            '<span class="txt">Connexion</span>' +
          '</a>' +
          '<a href="/register.html" class="btn-mini" style="border-color:transparent;color:white;" aria-label="Inscription">' +
            '<span style="display:inline-flex;align-items:center;gap:8px;" class="txt-wrap">' +
              _VF_SVG_REGISTER +
              '<span class="txt">Inscription</span>' +
            '</span>' +
          '</a>';

        const links = area.querySelectorAll("a");
        if(links && links[1]){
          links[1].style.background = "linear-gradient(90deg, #F07E13 0%, #FFB26B 100%)";
        }
        return;
      }

      const display = _vfSafe(s.username || s.email || "Compte");
      const first = display.slice(0,1).toUpperCase();

      area.innerHTML =
        '<div class="hidden md:flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-2xl">' +
          '<div class="w-8 h-8 rounded-xl" style="background:linear-gradient(90deg,#F07E13 0%,#FFB26B 100%);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;">' +
            first +
          '</div>' +
          '<div class="leading-tight">' +
            '<div class="text-[11px] font-black text-gray-900">Bonjour, ' + display + '</div>' +
            '<div class="text-[9px] font-black uppercase tracking-widest text-gray-300">Connecté</div>' +
          '</div>' +
        '</div>' +
        '<button id="logoutBtn" class="btn-mini" type="button">Déconnexion</button>';

      const btn = document.getElementById("logoutBtn");
      if(btn){
        btn.addEventListener("click", () => {
          localStorage.removeItem("vf_session");
          localStorage.setItem("vf_session_changed", String(Date.now()));
          renderAccountUI_();
        });
      }
    }

    renderAccountUI_();
  </script>

  <!-- Prix revendeur dynamique + lien paiement cohérent -->
  <script>
    const VF_SCRIPT_URL = "${escHtml(SCRIPT_URL)}";
    const VF_PRODUCT_ID = "${escHtml(id)}";

    function _vfSafe2(v){ return (v === null || v === undefined) ? "" : String(v); }

    function _vfGetStore(){
      return (window.vfApi && window.vfApi.storage) ? window.vfApi.storage
           : (window.vfStorage ? window.vfStorage : null);
    }

    function _vfGetCookie(name){
      try{
        const m = document.cookie.match(new RegExp("(^|;)\\\\s*" + name + "\\\\s*=\\\\s*([^;]+)"));
        return m ? decodeURIComponent(m[2]) : "";
      }catch(e){ return ""; }
    }

    function _vfGetSession(){
      try{
        const raw = localStorage.getItem("vf_session");
        if(!raw) return null;
        const s = JSON.parse(raw);
        if(!s || (!s.email && !s.username)) return null;
        return s;
      }catch(e){ return null; }
    }

    function _vfGetToken(){
      // 0) session fields
      try{
        const s = _vfGetSession();
        const t = s && (s.token || s.vf_token || s.reseller_token || s.access_token || s.session_token);
        if (t) return String(t).trim();
      }catch(e){}

      // 1) vf_api.js storage
      try{
        const st = _vfGetStore();
        if (st && typeof st.getToken === "function"){
          const t = st.getToken();
          if (t) return String(t).trim();
        }
      }catch(e){}

      // 2) localStorage
      try{
        const t2 = localStorage.getItem("vf_token");
        if (t2) return String(t2).trim();
      }catch(e){}

      // 3) cookie
      const ck = _vfGetCookie("vf_token");
      if (ck){
        try{ localStorage.setItem("vf_token", ck); }catch(e){}
        return String(ck).trim();
      }

      return "";
    }

    function _vfPickPrice(prod){
      // IMPORTANT: revendeur en priorité
      const v = prod && (
        prod.prix_affiche ??
        prod.prix_revendeur ??
        prod.RESELLER ?? prod.reseller ??
        prod.prix ??
        prod.price ??
        prod.amount ??
        prod.PV ?? prod.pv ??
        prod.prix_client
      );
      return _vfSafe2(v).trim();
    }

    function _vfBuildPayUrl(prod, priceOverride){
      const qp = new URLSearchParams();
      qp.set("nom", _vfSafe2(prod.nom));
      qp.set("prix", _vfSafe2(priceOverride));
      qp.set("cat", _vfSafe2(prod.cat));
      qp.set("id", _vfSafe2(prod.id));
      qp.set("min", _vfSafe2(prod.min));
      qp.set("max", _vfSafe2(prod.max));
      qp.set("img", _vfSafe2(prod.img || ""));
      qp.set("desc", _vfSafe2(prod.desc || "").trim());
      return "/paiement.html?" + qp.toString();
    }

    function _vfExtractList(payload){
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.products)) return payload.products;
      if (payload && Array.isArray(payload.items)) return payload.items;
      if (payload && Array.isArray(payload.data)) return payload.data;
      if (payload && payload.data && Array.isArray(payload.data.products)) return payload.data.products;
      if (payload && payload.data && Array.isArray(payload.data.items)) return payload.data.items;
      return [];
    }

    function _vfJsonpGetProducts(token){
      return new Promise((resolve, reject) => {
        const cb = "vf_cb_" + Date.now() + "_" + Math.floor(Math.random()*1000000);
        window[cb] = (payload) => {
          try{
            resolve(_vfExtractList(payload));
          }finally{
            try{ delete window[cb]; }catch(e){}
          }
        };

        const tokenParam = token ? ("&token=" + encodeURIComponent(token)) : "";
        const s = document.createElement("script");
        s.src = VF_SCRIPT_URL + "?action=get_products" + tokenParam + "&callback=" + cb + "&t=" + Date.now();
        s.onerror = () => {
          try{ delete window[cb]; }catch(e){}
          reject(new Error("JSONP error"));
        };
        document.body.appendChild(s);
      });
    }

    async function _vfRefreshPrice(){
      const token = _vfGetToken();
      if(!token) return;

      // UI: loading (évite que l’utilisateur pense que c’est le prix client)
      const priceEl = document.getElementById("priceValue");
      const buyBtn = document.getElementById("buyBtn");
      if (priceEl) priceEl.textContent = "... $";
      if (buyBtn){
        buyBtn.classList.add("opacity-60");
        buyBtn.style.pointerEvents = "none";
      }

      try{
        const list = await _vfJsonpGetProducts(token);
        const prod = list.find(x => _vfSafe2(x && x.id).trim() === VF_PRODUCT_ID);
        if(!prod) return;

        const raw = _vfPickPrice(prod);
        if(!raw) return;

        const num = parseFloat(String(raw).replace(",", "."));
        const txt = Number.isFinite(num) ? num.toFixed(2) : raw;

        if(priceEl) priceEl.textContent = txt + " $";
        if(buyBtn){
          buyBtn.href = _vfBuildPayUrl(prod, txt);
          buyBtn.classList.remove("opacity-60");
          buyBtn.style.pointerEvents = "auto";
        }
      }catch(e){
        // si erreur: on laisse le prix client
        if (priceEl) priceEl.textContent = "${escHtml(prixClient)} $";
        if (buyBtn){
          buyBtn.classList.remove("opacity-60");
          buyBtn.style.pointerEvents = "auto";
        }
      }
    }

    function _vfStartPrice(){
      _vfRefreshPrice();

      // petit retry si token apparaît après coup
      setTimeout(() => { _vfRefreshPrice(); }, 700);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", _vfStartPrice);
    } else {
      _vfStartPrice();
    }

    window.addEventListener("storage", (e) => {
      if (e.key === "vf_session" || e.key === "vf_token" || e.key === "vf_session_changed") {
        _vfRefreshPrice();
      }
    });
  </script>

</body>
</html>`;
}

function templateSharePage(p) {
  const id = safe(p.id).trim();
  const nom = safe(p.nom).trim() || `Produit ${id}`;
  const cat = safe(p.cat).trim() || "Service";
  const prix = safe(p.prix).trim() || "0";

  const imgRaw = safe(p.img).trim();
  const ogImg = toDirectOGImage(imgRaw) || ogFallback();

  const productUrl = `/p/${encodeURIComponent(id)}/`;
  const ogDesc = `${prix} $ • ${cat}`.slice(0, 200);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escHtml(nom)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(ogDesc)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(nom)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImg)}">
  <meta property="og:url" content="https://viralflowr.com/share/${encodeURIComponent(id)}/">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(ogImg)}">

  <meta http-equiv="refresh" content="0;url=${escHtml(productUrl)}">
</head>
<body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:20px;">
  <a href="${escHtml(productUrl)}">Ouvrir le produit</a>
</body>
</html>`;
}

// ---------- main ----------
async function main() {
  const products = await fetchProducts();

  rmDir("p");
  rmDir("share");
  ensureDir("p");
  ensureDir("share");

  let count = 0;

  for (const p of products) {
    const id = safe(p.id).trim();
    if (!id) continue;

    const pDir = path.join("p", id);
    ensureDir(pDir);
    fs.writeFileSync(path.join(pDir, "index.html"), templateProductPage(p), "utf-8");

    const sDir = path.join("share", id);
    ensureDir(sDir);
    fs.writeFileSync(path.join(sDir, "index.html"), templateSharePage(p), "utf-8");

    count++;
  }

  console.log(`Pages générées: ${count} produits (p/* + share/*).`);
}

main().catch((e) => {
  console.error("Erreur:", e);
  process.exit(1);
});
