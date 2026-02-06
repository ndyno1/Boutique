// scripts/generate-pages.mjs
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();

const SITE_BASE = (process.env.SITE_BASE || "https://viralflowr.com").replace(/\/+$/, "");
const VF_SCRIPT_URL =
  process.env.VF_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || "25000", 10);
const EXPECT_ID = (process.env.EXPECT_ID || "").trim(); // optionnel: ex "1767"

const OUT_P = path.join(ROOT, "p");
const OUT_SHARE = path.join(ROOT, "share");

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function cleanId(v) {
  return safeStr(v).trim();
}

function escapeHtml(s) {
  return safeStr(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function truncateText(s, n = 160) {
  const t = safeStr(s).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trim() + "…";
}

function formatPrice(v) {
  const s = safeStr(v).trim().replace(",", ".");
  const num = Number(s);
  if (!Number.isFinite(num)) return safeStr(v).trim() || "0";
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
  return num.toFixed(2);
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
      const v = obj[k];
      if (safeStr(v).trim() !== "") return v;
    }
  }
  return "";
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.products)) return payload.data.products;
  if (payload && payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  return [];
}

async function fetchText(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "follow" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}\n${text.slice(0, 300)}`);
    return text;
  } finally {
    clearTimeout(t);
  }
}

function parseJsonOrJsonp(text) {
  const t = safeStr(text).trim();

  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    return JSON.parse(t);
  }

  const m = t.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\)\s*;?\s*$/);
  if (m) return JSON.parse(m[1].trim());

  const fb = t.indexOf("{");
  const lb = t.lastIndexOf("}");
  if (fb !== -1 && lb !== -1 && lb > fb) return JSON.parse(t.slice(fb, lb + 1));

  const fa = t.indexOf("[");
  const la = t.lastIndexOf("]");
  if (fa !== -1 && la !== -1 && la > fa) return JSON.parse(t.slice(fa, la + 1));

  throw new Error("Réponse non-JSON / non-JSONP (impossible à parser).");
}

function normalizeProduct(raw) {
  const id = cleanId(pick(raw, ["id", "ID", "product_id", "productId", "pid"]));
  const nom = safeStr(pick(raw, ["nom", "name", "title", "product_name"])).trim();
  const cat = safeStr(pick(raw, ["cat", "category", "categorie"])).trim();
  const img = safeStr(pick(raw, ["img", "image", "image_url", "imageUrl", "thumbnail"])).trim();

  const prixClient = pick(raw, ["prix", "price", "amount", "prix_client", "PV", "pv"]);
  const min = safeStr(pick(raw, ["min", "minimum"])).trim();
  const max = safeStr(pick(raw, ["max", "maximum"])).trim();

  // ✅ IMPORTANT: UNIQUEMENT long_desc (colonne K)
  // ❌ AUCUN fallback sur desc/description (colonne C)
  const long_desc = safeStr(
    pick(raw, ["long_desc", "longDesc", "long_description", "longDescription", "desc_long", "longdesc"])
  ).trim();

  return {
    id,
    nom: nom || `Produit ${id}`,
    cat: cat || "",
    img: img || "",
    priceTxt: formatPrice(prixClient),
    min,
    max,
    long_desc, // peut être vide si ta K est vide
  };
}

function buildPayUrl(prod) {
  const qp = new URLSearchParams();
  qp.set("nom", safeStr(prod.nom));
  qp.set("prix", safeStr(prod.priceTxt));
  qp.set("cat", safeStr(prod.cat));
  qp.set("id", safeStr(prod.id));
  qp.set("min", safeStr(prod.min));
  qp.set("max", safeStr(prod.max));
  qp.set("img", safeStr(prod.img || ""));
  // ✅ desc= UNIQUEMENT long_desc (colonne K)
  qp.set("desc", safeStr(prod.long_desc || "").trim());
  return "/paiement.html?" + qp.toString();
}

function renderProductPage(prod) {
  const id = prod.id;
  const canonical = `${SITE_BASE}/p/${encodeURIComponent(id)}/`;
  const ogImg = prod.img || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  // ✅ meta description basé UNIQUEMENT sur long_desc (K)
  const seoDescBase = truncateText(prod.long_desc, 140);
  const seoDesc = `${prod.priceTxt} $ • ${prod.cat || "Produit"}${seoDescBase ? " • " + seoDescBase : ""}`.trim();

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: prod.nom,
    image: [ogImg],
    // ✅ description schema = long_desc uniquement
    description: prod.long_desc || "",
    brand: { "@type": "Brand", name: "ViralFlowr" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: prod.priceTxt,
      availability: "https://schema.org/InStock",
      url: canonical,
    },
  };

  const payHref = buildPayUrl(prod);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escapeHtml(prod.nom)} | ViralFlowr</title>
  <meta name="description" content="${escapeAttr(seoDesc)}">
  <link rel="canonical" href="${escapeAttr(canonical)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escapeAttr(prod.nom)}">
  <meta property="og:description" content="${escapeAttr(seoDesc)}">
  <meta property="og:image" content="${escapeAttr(ogImg)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escapeAttr(ogImg)}">

  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    :root{ --vf-orange:#F07E13; --vf-orange2:#FFB26B; --vf-bg:#F3F3F3; --vf-text:#201B16; }
    html, body { width:100%; max-width:100%; overflow-x:hidden; }
    *{ box-sizing:border-box; }
    body{
      font-family:'Inter', sans-serif;
      background: radial-gradient(1000px 700px at 20% -10%, rgba(240,126,19,.10), transparent 60%),
                  radial-gradient(900px 600px at 100% 0%, rgba(255,178,107,.12), transparent 55%),
                  var(--vf-bg);
      color:var(--vf-text);
      -webkit-text-size-adjust:100%;
      padding-bottom: env(safe-area-inset-bottom);
      overscroll-behavior-x:none;
    }
    .no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
    .no-scrollbar::-webkit-scrollbar{ display:none; }

    .text-orange-bsv { color: var(--vf-orange); }
    .btn-gradient { background: linear-gradient(90deg, var(--vf-orange) 0%, var(--vf-orange2) 100%); }
    .shadow-card { box-shadow: 0 12px 30px rgba(0,0,0,.08); }

    .btn-mini{
      height:40px; padding:0 14px; border-radius:999px;
      font-weight:900; font-size:11px; letter-spacing:.10em;
      text-transform:uppercase;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:1px solid #E5E7EB; background:#fff; color:#111827;
      transition:.18s; white-space:nowrap; flex:0 0 auto;
      max-width:100%;
    }
    .btn-mini:hover{ transform: translateY(-1px); border-color:var(--vf-orange); color:var(--vf-orange); }

    .btn-waba{
      height:40px; padding:0 14px; border-radius:999px;
      font-weight:900; font-size:11px; letter-spacing:.10em;
      text-transform:uppercase;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      border:1px solid rgba(37,211,102,.25);
      background:#25D366; color:#fff;
      transition:.18s; white-space:nowrap; flex:0 0 auto;
      max-width:100%;
    }
    .btn-waba:hover{ transform: translateY(-1px); filter: brightness(1.02); }

    .icon-btn{
      width:40px; height:40px; border-radius:999px;
      border:1px solid #E5E7EB; background:#fff; color:#374151;
      display:flex; align-items:center; justify-content:center;
      transition:.18s; flex:0 0 auto;
    }
    .icon-btn:hover{ transform: translateY(-1px); border-color: rgba(240,126,19,.35); color: var(--vf-orange); }

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

  <header class="bg-white/90 backdrop-blur sticky top-0 w-full z-50 border-b border-gray-200 shadow-sm">
    <div class="max-w-[1240px] mx-auto h-16 px-4 flex items-center justify-between gap-3">
      <a class="flex items-center gap-2 shrink-0 vf-brand-wrap" href="/index.html" aria-label="Boutique ViralFlowr">
        <div class="text-2xl font-black tracking-tighter vf-brand-text">
          Viral<span class="text-orange-bsv">Flowr</span>
        </div>
      </a>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
        <div id="accountArea" class="hidden sm:flex items-center gap-2"></div>

        <a class="icon-btn" href="/commandes.html" title="Mes commandes" aria-label="Mes commandes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path><path d="M4 6h.01"></path><path d="M4 12h.01"></path><path d="M4 18h.01"></path>
          </svg>
        </a>

        <a class="icon-btn" href="/wallet.html" title="Portefeuille" aria-label="Portefeuille">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"></path>
            <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"></path>
            <path d="M20 12h-4a2 2 0 0 0 0 4h4"></path>
            <circle cx="16" cy="14" r="0.5" />
          </svg>
        </a>

        <a href="/index.html" class="btn-mini" aria-label="Boutique">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8"></path><path d="M9 22V12h6v10"></path>
          </svg>
          <span class="txt">Boutique</span>
        </a>

        <a href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer" class="btn-waba" aria-label="WABA WhatsApp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
          </svg>
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
            <h1 class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">${escapeHtml(prod.nom)}</h1>

            <div class="flex flex-col sm:flex-row gap-6">
              <div class="shrink-0">
                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                  <img src="${escapeAttr(ogImg)}" class="w-full h-full object-contain"
                       onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"
                       alt="${escapeAttr(prod.nom)}">
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                <!-- ✅ ICI: UNIQUEMENT long_desc (K) -->
                <div class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium break-words">
${escapeHtml(prod.long_desc || "")}
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
                <span id="priceValue" class="text-3xl font-black text-[#201B16] tracking-tighter">${escapeHtml(prod.priceTxt)} $</span>
              </div>
              <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                <span>Min : <strong class="text-gray-700">${escapeHtml(prod.min || "1")}</strong></span>
                <span>Max : <strong class="text-gray-700">${escapeHtml(prod.max || "∞")}</strong></span>
              </div>
            </div>

            <a id="buyBtn" href="${escapeAttr(payHref)}"
               class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center">
              Acheter maintenant
            </a>

            <a href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer"
               class="w-full h-12 rounded-full bg-[#25D366] text-white font-black text-[13px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-.1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
              Contacter WABA
            </a>

            <a href="/share/${encodeURIComponent(id)}/"
               class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold hover:text-orange-500 transition-colors">
              Partager ce produit
            </a>
          </div>

          <a href="/index.html"
             class="bg-white border border-gray-200 shadow-card rounded-xl p-4 flex items-center justify-center gap-2 text-gray-600 font-black uppercase text-[12px] hover:text-orange-600 hover:border-orange-200 transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 11l9-8 9 8"></path><path d="M9 22V12h6v10"></path>
            </svg>
            Retour Boutique
          </a>
        </aside>

      </div>
    </div>
  </main>

  <footer class="mt-auto bg-white border-t border-gray-200">
    <div class="max-w-[1240px] mx-auto px-4 py-10">
      <div class="text-xl font-black tracking-tighter">
        Viral<span class="text-orange-bsv">Flowr</span>
      </div>
      <div class="mt-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        © 2026 ViralFlowr • Paiement sécurisé • Livraison digitale
      </div>
    </div>
  </footer>

  <!-- Account UI (inchangé) -->
  <script>
    const _VF_SVG_LOGIN = "<svg width=\\"16\\" height=\\"16\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\" viewBox=\\"0 0 24 24\\" aria-hidden=\\"true\\">\\n    <path d=\\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\\"></path>\\n    <path d=\\"M10 17l5-5-5-5\\"></path>\\n    <path d=\\"M15 12H3\\"></path>\\n  </svg>";
    const _VF_SVG_REGISTER = "<svg width=\\"16\\" height=\\"16\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\" viewBox=\\"0 0 24 24\\" aria-hidden=\\"true\\">\\n    <path d=\\"M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\\"></path>\\n    <circle cx=\\"8.5\\" cy=\\"7\\" r=\\"4\\"></circle>\\n    <path d=\\"M20 8v6\\"></path>\\n    <path d=\\"M23 11h-6\\"></path>\\n  </svg>";

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
    const VF_SCRIPT_URL = ${JSON.stringify(VF_SCRIPT_URL)};
    const VF_PRODUCT_ID = ${JSON.stringify(String(id))};

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
      try{
        const s = _vfGetSession();
        const t = s && (s.token || s.vf_token || s.reseller_token || s.access_token || s.session_token);
        if (t) return String(t).trim();
      }catch(e){}

      try{
        const st = _vfGetStore();
        if (st && typeof st.getToken === "function"){
          const t = st.getToken();
          if (t) return String(t).trim();
        }
      }catch(e){}

      try{
        const t2 = localStorage.getItem("vf_token");
        if (t2) return String(t2).trim();
      }catch(e){}

      const ck = _vfGetCookie("vf_token");
      if (ck){
        try{ localStorage.setItem("vf_token", ck); }catch(e){}
        return String(ck).trim();
      }

      return "";
    }

    function _vfPickPrice(prod){
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
      // ✅ IMPORTANT: desc= UNIQUEMENT long_desc (K). AUCUN fallback.
      qp.set("desc", _vfSafe2(prod.long_desc || prod.longDesc || prod.long_description || "").trim());
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
          try{ resolve(_vfExtractList(payload)); }
          finally{ try{ delete window[cb]; }catch(e){} }
        };

        const tokenParam = token ? ("&token=" + encodeURIComponent(token)) : "";
        const s = document.createElement("script");
        s.src = VF_SCRIPT_URL + "?action=get_products" + tokenParam + "&callback=" + cb + "&t=" + Date.now();
        s.onerror = () => { try{ delete window[cb]; }catch(e){} reject(new Error("JSONP error")); };
        document.body.appendChild(s);
      });
    }

    async function _vfRefreshPrice(){
      const token = _vfGetToken();
      if(!token) return;

      const priceEl = document.getElementById("priceValue");
      const buyBtn = document.getElementById("buyBtn");
      if (priceEl) priceEl.textContent = "... $";
      if (buyBtn){ buyBtn.classList.add("opacity-60"); buyBtn.style.pointerEvents = "none"; }

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
        if (priceEl) priceEl.textContent = ${JSON.stringify(String(prod.priceTxt))} + " $";
        if (buyBtn){ buyBtn.classList.remove("opacity-60"); buyBtn.style.pointerEvents = "auto"; }
      }
    }

    function _vfStartPrice(){
      _vfRefreshPrice();
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

function renderSharePage(prod) {
  const id = prod.id;
  const target = `/p/${encodeURIComponent(id)}/`;
  const canonical = `${SITE_BASE}${target}`;
  const ogImg = prod.img || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  const seoDescBase = truncateText(prod.long_desc, 140);
  const seoDesc = `${prod.priceTxt} $ • ${prod.cat || "Produit"}${seoDescBase ? " • " + seoDescBase : ""}`.trim();

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(prod.nom)} | Partage</title>
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escapeAttr(prod.nom)}">
  <meta property="og:description" content="${escapeAttr(seoDesc)}">
  <meta property="og:image" content="${escapeAttr(ogImg)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  <meta http-equiv="refresh" content="0;url=${escapeAttr(target)}">
  <script>location.replace(${JSON.stringify(target)});</script>
</head>
<body></body>
</html>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function fetchProducts() {
  const url = `${VF_SCRIPT_URL}?action=get_products&t=${Date.now()}`;
  const txt = await fetchText(url);
  const payload = parseJsonOrJsonp(txt);
  return extractList(payload);
}

async function main() {
  console.log("VF_SCRIPT_URL =", VF_SCRIPT_URL);
  console.log("SITE_BASE     =", SITE_BASE);

  const rawList = await fetchProducts();
  if (!rawList.length) throw new Error("Aucun produit reçu depuis l'API (get_products).");

  await ensureDir(OUT_P);
  await ensureDir(OUT_SHARE);

  let generated = 0;

  for (const raw of rawList) {
    const prod = normalizeProduct(raw);
    if (!prod.id) continue;

    const pIndex = path.join(OUT_P, prod.id, "index.html");
    const sIndex = path.join(OUT_SHARE, prod.id, "index.html");

    await writeFile(pIndex, renderProductPage(prod));
    await writeFile(sIndex, renderSharePage(prod));
    generated++;
  }

  console.log(`Pages générées: ${generated}`);

  if (EXPECT_ID) {
    const checkPath = path.join(OUT_P, EXPECT_ID, "index.html");
    try {
      await fs.access(checkPath);
      console.log(`OK: ${checkPath} existe`);
    } catch {
      throw new Error(`KO: ${checkPath} manquant => /p/${EXPECT_ID}/ fera 404`);
    }
  }
}

main().catch((e) => {
  console.error("ERROR:", e?.stack || e?.message || e);
  process.exit(1);
});
