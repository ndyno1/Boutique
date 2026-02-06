// scripts/generate-pages.mjs
import fs from "fs/promises";
import path from "path";

const SITE_URL = (process.env.SITE_URL || "https://viralflowr.com").replace(/\/+$/, "");
const SCRIPT_URL =
  process.env.VF_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const OUT_P_DIR = process.env.OUT_P_DIR || "p";
const OUT_SHARE_DIR = process.env.OUT_SHARE_DIR || "share";

const TOKEN = (process.env.VF_TOKEN || "").trim(); // optionnel
const CLEAN = String(process.env.CLEAN || "").trim() === "1"; // optionnel

// ----------------- Helpers -----------------
function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}
function escHtml(str) {
  return safe(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
function stripTags(s) {
  return safe(s).replace(/<[^>]*>/g, "");
}
function oneLine(s) {
  return safe(s).replace(/\s+/g, " ").trim();
}
function truncate(s, n) {
  const t = safe(s);
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd();
}
function sanitizeIdSegment(id) {
  return safe(id).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
async function writeFileIfChanged(filePath, content) {
  try {
    const prev = await fs.readFile(filePath, "utf8");
    if (prev === content) return false;
  } catch (_) {}
  await fs.writeFile(filePath, content, "utf8");
  return true;
}
async function listDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (_) {
    return [];
  }
}

function isLikelyJson(text) {
  const t = safe(text).trim();
  return t.startsWith("{") || t.startsWith("[");
}
function stripJsonp(text) {
  const t = safe(text).trim();
  const i = t.indexOf("(");
  const j = t.lastIndexOf(")");
  if (i === -1 || j === -1 || j <= i) return null;
  const inside = t.slice(i + 1, j).trim();
  if (!isLikelyJson(inside)) return null;
  return inside;
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, text: txt };
  } finally {
    clearTimeout(timer);
  }
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

async function fetchProducts() {
  // 1) JSON direct
  {
    const qs = new URLSearchParams({
      action: "get_products",
      t: String(Date.now()),
      ...(TOKEN ? { token: TOKEN } : {}),
    });
    const url = `${SCRIPT_URL}?${qs.toString()}`;
    const r = await fetchText(url);
    if (r.ok && isLikelyJson(r.text)) {
      const json = JSON.parse(r.text);
      return extractList(json);
    }
  }

  // 2) JSONP fallback
  {
    const qs = new URLSearchParams({
      action: "get_products",
      callback: "VF_NODE_CB",
      t: String(Date.now()),
      ...(TOKEN ? { token: TOKEN } : {}),
    });
    const url = `${SCRIPT_URL}?${qs.toString()}`;
    const r = await fetchText(url);

    if (!r.ok) throw new Error(`API get_products inaccessible (status ${r.status}).`);

    const inside = stripJsonp(r.text);
    if (!inside) {
      const head = oneLine(r.text).slice(0, 220);
      throw new Error(`Réponse API non-JSON/JSONP. Début: ${head}`);
    }

    const json = JSON.parse(inside);
    return extractList(json);
  }
}

// ----------------- Mapping produit (adapte aux noms de champs) -----------------
function pId(p) {
  // colonne B => souvent "id"
  return safe(p?.id || p?.product_id || p?.productId).trim();
}
function pName(p) {
  return safe(p?.nom || p?.name || p?.title).trim();
}
function pCat(p) {
  return safe(p?.cat || p?.category || p?.categorie).trim();
}
function pImg(p) {
  return safe(p?.img || p?.image || p?.photo).trim();
}
function pMin(p) {
  return safe(p?.min || p?.minqnt || p?.minQty || p?.min_qty).trim();
}
function pMax(p) {
  return safe(p?.max || p?.maxqnt || p?.maxQty || p?.max_qty).trim();
}
function pPrice(p) {
  // priorité revendeur si API renvoie
  return safe(
    p?.prix_affiche ??
      p?.prix_revendeur ??
      p?.RESELLER ??
      p?.reseller ??
      p?.prix ??
      p?.price ??
      p?.amount ??
      p?.PV ??
      p?.pv ??
      p?.prix_client
  ).trim();
}
function pDesc(p) {
  // description affichée dans la page
  return safe(
    p?.desc ??
      p?.description ??
      p?.details ??
      p?.long_desc ??
      p?.longDescription ??
      ""
  ).trim();
}
function pPayDesc(p) {
  // texte envoyé dans le paramètre desc= de /paiement.html
  // (dans ton exemple c’est un texte "Veuillez saisir ...")
  // Si tu as une colonne dédiée, elle doit arriver ici.
  return safe(
    p?.desc_pay ??
      p?.payment_desc ??
      p?.pay_desc ??
      p?.desc_commande ??
      p?.commande_desc ??
      p?.instructions ??
      p?.note ??
      p?.desc_short ??
      ""
  ).trim();
}

// ----------------- Templates (match ton style) -----------------
function buildBuyUrl(prod, priceStr) {
  const qp = new URLSearchParams();
  qp.set("nom", pName(prod));
  qp.set("prix", safe(priceStr));
  qp.set("cat", pCat(prod));
  qp.set("id", pId(prod));
  qp.set("min", pMin(prod));
  qp.set("max", pMax(prod));
  qp.set("img", pImg(prod));
  // IMPORTANT: si tu as une colonne "desc paiement", elle sera utilisée
  const dpay = pPayDesc(prod) || pDesc(prod);
  qp.set("desc", dpay);
  return `/paiement.html?${qp.toString()}`;
}

function productHtml(prod) {
  const id = pId(prod);
  const seg = sanitizeIdSegment(id);

  const name = pName(prod) || `Produit ${id}`;
  const cat = pCat(prod) || "Produit";
  const img = pImg(prod) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const desc = pDesc(prod) || "";
  const priceRaw = pPrice(prod) || "";
  const priceNum = parseFloat(priceRaw.replace(",", "."));
  const price = Number.isFinite(priceNum) ? String(priceNum) : (priceRaw || "0");

  const min = pMin(prod) || "";
  const max = pMax(prod) || "";

  const canonical = `${SITE_URL}/p/${encodeURIComponent(seg)}/`;
  const metaDesc = truncate(oneLine(`${price} $ • ${cat} • ${stripTags(desc)}`), 160);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: [img],
    description: desc,
    brand: { "@type": "Brand", name: "ViralFlowr" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: price,
      availability: "https://schema.org/InStock",
      url: canonical,
    },
  };

  const buyHref = buildBuyUrl(prod, price);

  const maxDisplay = max ? max : "∞";

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escHtml(name)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(metaDesc)}">
  <link rel="canonical" href="${escHtml(canonical)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(name)}">
  <meta property="og:description" content="${escHtml(metaDesc)}">
  <meta property="og:image" content="${escHtml(img)}">
  <meta property="og:url" content="${escHtml(canonical)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(img)}">

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

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

        <a class="icon-btn" href="/commandes.html" title="Mes commandes" aria-label="Mes commandes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 6h11"></path><path d="M9 12h11"></path><path d="M9 18h11"></path>
            <path d="M4 6h.01"></path><path d="M4 12h.01"></path><path d="M4 18h.01"></path>
          </svg>
        </a>

        <a class="icon-btn" href="/wallet.html" title="Portefeuille" aria-label="Portefeuille">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
            <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
            <path d="M20 12h-4a2 2 0 0 0 0 4h4"/>
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
            <h1 class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">${escHtml(name)}</h1>

            <div class="flex flex-col sm:flex-row gap-6">
              <div class="shrink-0">
                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                  <img src="${escHtml(img)}" class="w-full h-full object-contain"
                       onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"
                       alt="${escHtml(name)}">
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                <div class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium break-words">${escHtml(desc)}</div>
              </div>
            </div>
          </div>
        </div>

        <aside class="flex flex-col gap-4">
          <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-6">
            <div class="grid grid-cols-2 gap-4 items-end">
              <div>
                <span class="text-gray-500 text-xs font-medium block mb-1">Prix Total:</span>
                <span id="priceValue" class="text-3xl font-black text-[#201B16] tracking-tighter">${escHtml(price)} $</span>
              </div>
              <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                <span>Min : <strong class="text-gray-700">${escHtml(min || "1")}</strong></span>
                <span>Max : <strong class="text-gray-700">${escHtml(maxDisplay)}</strong></span>
              </div>
            </div>

            <a id="buyBtn" href="${escHtml(buyHref)}"
               class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center">
              Acheter maintenant
            </a>

            <a href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer"
               class="w-full h-12 rounded-full bg-[#25D366] text-white font-black text-[13px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
              </svg>
              Contacter WABA
            </a>

            <a href="/share/${escHtml(seg)}/"
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

  <!-- Account UI (comme ton ancien) -->
  <script>
    const _VF_SVG_LOGIN = "<svg width=\\"16\\" height=\\"16\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\" viewBox=\\"0 0 24 24\\" aria-hidden=\\"true\\"><path d=\\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\\"></path><path d=\\"M10 17l5-5-5-5\\"></path><path d=\\"M15 12H3\\"></path></svg>";
    const _VF_SVG_REGISTER = "<svg width=\\"16\\" height=\\"16\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.5\\" viewBox=\\"0 0 24 24\\" aria-hidden=\\"true\\"><path d=\\"M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\\"></path><circle cx=\\"8.5\\" cy=\\"7\\" r=\\"4\\"></circle><path d=\\"M20 8v6\\"></path><path d=\\"M23 11h-6\\"></path></svg>";

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

  <!-- Prix revendeur dynamique + lien paiement cohérent (injecte ID + prix par défaut) -->
  <script>
    const VF_SCRIPT_URL = ${JSON.stringify(SCRIPT_URL)};
    const VF_PRODUCT_ID = ${JSON.stringify(id)};

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
      qp.set("nom", _vfSafe2(prod.nom || prod.name || prod.title));
      qp.set("prix", _vfSafe2(priceOverride));
      qp.set("cat", _vfSafe2(prod.cat || prod.category || prod.categorie));
      qp.set("id", _vfSafe2(prod.id));
      qp.set("min", _vfSafe2(prod.min || prod.minqnt || prod.minQty || prod.min_qty));
      qp.set("max", _vfSafe2(prod.max || prod.maxqnt || prod.maxQty || prod.max_qty));
      qp.set("img", _vfSafe2(prod.img || prod.image || prod.photo || ""));
      qp.set("desc", _vfSafe2(
        prod.desc_pay || prod.payment_desc || prod.pay_desc ||
        prod.desc_commande || prod.commande_desc ||
        prod.instructions || prod.note || prod.desc_short ||
        prod.desc || prod.description || ""
      ).trim());
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
        if (priceEl) priceEl.textContent = ${JSON.stringify(price + " $")};
        if (buyBtn){
          buyBtn.classList.remove("opacity-60");
          buyBtn.style.pointerEvents = "auto";
        }
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

function shareHtml(prod) {
  const id = pId(prod);
  const seg = sanitizeIdSegment(id);
  const name = pName(prod) || `Produit ${id}`;
  const img = pImg(prod) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const canonical = `${SITE_URL}/share/${encodeURIComponent(seg)}/`;
  const productUrl = `${SITE_URL}/p/${encodeURIComponent(seg)}/`;

  const metaDesc = truncate(oneLine(stripTags(pDesc(prod))), 160);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>Partager • ${escHtml(name)} | ViralFlowr</title>
  <link rel="canonical" href="${escHtml(canonical)}"/>
  <meta name="description" content="${escHtml(metaDesc)}"/>

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(name)}">
  <meta property="og:description" content="${escHtml(metaDesc)}">
  <meta property="og:image" content="${escHtml(img)}">
  <meta property="og:url" content="${escHtml(productUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(img)}">

  <script>
    // redirection simple vers la page produit
    location.replace(${JSON.stringify(`/p/${seg}/`)});
  </script>
</head>
<body></body>
</html>`;
}

// ----------------- Main -----------------
async function main() {
  console.log("[gen] SITE_URL:", SITE_URL);
  console.log("[gen] SCRIPT_URL:", SCRIPT_URL);
  console.log("[gen] out:", OUT_P_DIR, OUT_SHARE_DIR);

  const products = await fetchProducts();
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("Liste produits vide (action=get_products).");
  }
  console.log("[gen] produits:", products.length);

  const pRoot = path.resolve(process.cwd(), OUT_P_DIR);
  const shareRoot = path.resolve(process.cwd(), OUT_SHARE_DIR);
  await ensureDir(pRoot);
  await ensureDir(shareRoot);

  const keepP = new Set();
  const keepS = new Set();

  let wroteP = 0;
  let wroteS = 0;

  for (const prod of products) {
    const id = pId(prod);
    if (!id) continue;

    const seg = sanitizeIdSegment(id);
    keepP.add(seg);
    keepS.add(seg);

    const pDir = path.join(pRoot, seg);
    const pFile = path.join(pDir, "index.html");
    await ensureDir(pDir);
    if (await writeFileIfChanged(pFile, productHtml(prod))) wroteP++;

    const sDir = path.join(shareRoot, seg);
    const sFile = path.join(sDir, "index.html");
    await ensureDir(sDir);
    if (await writeFileIfChanged(sFile, shareHtml(prod))) wroteS++;
  }

  if (CLEAN) {
    const existingP = await listDirs(pRoot);
    for (const d of existingP) {
      if (!keepP.has(d)) {
        await fs.rm(path.join(pRoot, d), { recursive: true, force: true });
        console.log("[gen] removed old p:", d);
      }
    }
    const existingS = await listDirs(shareRoot);
    for (const d of existingS) {
      if (!keepS.has(d)) {
        await fs.rm(path.join(shareRoot, d), { recursive: true, force: true });
        console.log("[gen] removed old share:", d);
      }
    }
  }

  console.log(`[gen] pages produit écrites/maj: ${wroteP}`);
  console.log(`[gen] pages share écrites/maj: ${wroteS}`);
  console.log(`[gen] exemple: ${OUT_P_DIR}/${[...keepP][0] || "ID"}/index.html`);
}

main().catch((e) => {
  console.error("[gen] ERROR:", e?.stack || e?.message || e);
  process.exit(1);
});
