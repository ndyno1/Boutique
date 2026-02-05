<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <!-- Canonical domaine (www -> non-www) sans boucle
       - une seule tentative par onglet (sessionStorage guard)
       - désactivé dans le panel Apps Script (embed)
  -->
  <script>
    (function () {
      const ref = document.referrer || "";
      const inAppsScriptPanel = /script\.googleusercontent\.com|script\.google\.com/i.test(ref);
      window.__VF_IN_APPS_SCRIPT_PANEL = inAppsScriptPanel;
      if (inAppsScriptPanel) return;

      const host = (location.hostname || "").toLowerCase();
      const isWWW = host === "www.viralflowr.com";
      const isApex = host === "viralflowr.com";
      const isTarget = isWWW || isApex;
      if (!isTarget) return;

      const CANON_HOST = "viralflowr.com";
      if (host === CANON_HOST) return;

      const GUARD_KEY = "vf_canon_redirect_guard";
      const now = Date.now();

      try {
        const guard = JSON.parse(sessionStorage.getItem(GUARD_KEY) || "null");
        if (guard && (now - guard.ts) < 15000) return;
        sessionStorage.setItem(GUARD_KEY, JSON.stringify({ ts: now, from: host, to: CANON_HOST }));
      } catch (_) {}

      location.replace("https://" + CANON_HOST + location.pathname + location.search + location.hash);
    })();
  </script>

  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>ViralFlowr | Boutique Officielle</title>

  <!-- SEO standard -->
  <meta name="description" content="Services Elite, Déblocage IMEI et Matériel High-Tech garantis." />
  <meta name="theme-color" content="#111827" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/favicon.png" />

  <meta property="og:title" content="ViralFlowr | Boutique Officielle" />
  <meta property="og:description" content="Services Elite, Déblocage IMEI et Matériel High-Tech garantis." />
  <meta property="og:image" content="https://content.bsvmarket.com/uploads/banner_hero_20b30c28bd.png" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://viralflowr.com/index.html" />

  <!-- Config avant /vf_api.js -->
  <script>
    const inAppsScriptPanel =
      !!window.__VF_IN_APPS_SCRIPT_PANEL ||
      /script\.googleusercontent\.com|script\.google\.com/i.test(document.referrer || "");

    window.VF_CONFIG = {
      scriptUrl: "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec",
      timeoutMs: 20000,
      debug: false,

      postMode: "auto",
      proxyUrl: "/vf_proxy",

      postMessageTargetOrigin: inAppsScriptPanel ? "*" : location.origin,

      cookieDomain: ".viralflowr.com",
      cookieTokenKey: "vf_token"
    };
  </script>

  <script src="/vf_api.js?v=200" defer></script>
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Perf fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
    body {
      font-family: 'Inter', sans-serif;
      scroll-behavior: smooth;
      overflow-x: hidden;
      min-height: 100svh;
      overscroll-behavior-x: none;
      touch-action: pan-y;
      -webkit-text-size-adjust: 100%;
      padding-bottom: env(safe-area-inset-bottom);
      background:#F8FAFC;
    }

    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .no-scrollbar::-webkit-scrollbar { display: none; }

    @keyframes placeholderAnimate {
      0% { opacity: 0; transform: translateY(8px); }
      15% { opacity: 1; transform: translateY(0); }
      85% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    .animate-text { animation: placeholderAnimate 4s infinite; }

    @media (prefers-reduced-motion: reduce){
      .animate-text { animation: none !important; }
      .hover-card, .hover-card:hover { transition: none !important; transform: none !important; }
    }

    .brand-gradient { background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%); }

    .hover-card { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .hover-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); border-color: #F07E13; }

    .btn-support{
      background:#25D366;color:#fff;padding:8px 16px;border-radius:12px;font-weight:800;
      font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;line-height:1;
      transition:.25s;-webkit-tap-highlight-color:transparent;flex-shrink:0;white-space:nowrap;max-width:100%;
    }
    .btn-support:hover{ transform:translateY(-1px); box-shadow:0 10px 15px -3px rgba(37,211,102,.28); }

    .btn-auth{
      padding:9px 14px;border-radius:14px;font-weight:900;font-size:11px;text-transform:uppercase;
      letter-spacing:.12em;transition:.2s;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;
      -webkit-tap-highlight-color:transparent;flex-shrink:0;
    }
    .btn-auth:hover{ transform:translateY(-1px); }
    .btn-auth-outline{ background:#fff;border:1px solid #E5E7EB;color:#111827; }
    .btn-auth-outline:hover{ border-color:#F07E13;color:#F07E13; }
    .btn-auth-primary{ color:#fff; }

    .line-clamp-2{
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }

    .vf-brand-wrap{ min-width:0; overflow:hidden; }
    .vf-brand-text{
      display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;
    }

    .icon-btn{
      display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:14px;
      background:#fff;border:1px solid #E5E7EB;color:#374151;transition:.2s;-webkit-tap-highlight-color:transparent;
      flex-shrink:0;
    }
    .icon-btn:hover{ border-color:#F07E13;color:#F07E13;transform:translateY(-1px); }

    #catNav{ touch-action: pan-x; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }

    header{ transform: translateZ(0); -webkit-transform: translateZ(0); }
    @media (max-width: 768px){
      header{ backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
    }

    @media (max-width: 420px){
      .icon-btn{ width:36px;height:36px;border-radius:12px; }
      .btn-support{ padding:8px 10px;border-radius:12px;font-size:11px;gap:6px; }
      .btn-support .btn-support-text{ display:none; }
      .btn-auth{ padding:8px 10px;border-radius:12px;font-size:10px;letter-spacing:.10em;gap:6px; }
      .vf-brand-text{ font-size:22px; }
    }

    /* Amélioration visuelle: badge "+" en gradient au survol (sans changer la logique) */
    .plus-badge{
      background:#111827;
      transition: background .2s ease, transform .2s ease;
    }
    .hover-card:hover .plus-badge{
      background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%);
      transform: translateY(-1px);
    }

    .cat-btn.active{
      color:#fff !important;
      background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%) !important;
      border-color: rgba(240,126,19,.25) !important;
    }
  </style>
</head>

<body>

  <div class="bg-gray-900 text-white py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
    MARKETPLACE PROFESSIONNELLE • LIVRAISON INTERNATIONALE • PAIEMENT SÉCURISÉ
  </div>

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/95">
    <div class="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">

      <a href="/index.html" class="flex items-center gap-2 shrink-0 vf-brand-wrap" aria-label="ViralFlowr">
        <div class="text-2xl font-black tracking-tighter text-gray-900 vf-brand-text">
          Viral<span class="text-[#F07E13]">Flowr</span>
        </div>
      </a>

      <div class="hidden lg:flex items-center gap-6 text-[11px] font-black uppercase tracking-widest text-gray-400">
        <a href="/index.html" class="hover:text-gray-900 transition-colors">Boutique</a>
        <a href="/about.html" class="hover:text-gray-900 transition-colors">À Propos</a>
      </div>

      <div class="relative flex-1 max-w-[600px] hidden md:flex items-center">
        <input type="text" id="searchInput"
          class="w-full h-11 pl-5 pr-12 rounded-xl bg-[#F1F5F9] text-sm font-semibold focus:ring-2 focus:ring-[#F07E13] focus:bg-white outline-none transition-all border-none"
          aria-label="Rechercher un produit">

        <div id="placeholder-box" class="absolute left-5 pointer-events-none text-gray-400 text-sm font-semibold">
          <span id="animated-placeholder" class="inline-block animate-text">Que cherchez-vous ? (SMM, iPhone, IMEI, Netflix...)</span>
        </div>

        <button type="button" class="absolute right-1.5 top-1.5 brand-gradient p-2 rounded-lg text-white shadow-md" aria-label="Rechercher">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <div id="accountArea" class="hidden sm:flex items-center gap-2"></div>

        <a href="/commandes.html" class="icon-btn" title="Mes commandes" aria-label="Mes commandes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 6h11"></path>
            <path d="M9 12h11"></path>
            <path d="M9 18h11"></path>
            <path d="M4 6h.01"></path>
            <path d="M4 12h.01"></path>
            <path d="M4 18h.01"></path>
          </svg>
        </a>

        <a href="/wallet.html" class="icon-btn" title="Portefeuille" aria-label="Portefeuille">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
            <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
            <path d="M20 12h-4a2 2 0 0 0 0 4h4"/>
            <circle cx="16" cy="14" r="0.5" />
          </svg>
        </a>

        <a href="https://www.instagram.com/di_corporation_1/" target="_blank" rel="noopener noreferrer"
          class="hidden sm:flex icon-btn" aria-label="Instagram">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect>
            <path d="M16 11.37a4 4 0 1 1-7.87 1.26 4 4 0 0 1 7.87-1.26z"></path>
            <path d="M17.5 6.5h.01"></path>
          </svg>
        </a>

        <a href="https://www.tiktok.com/@dicorporation" target="_blank" rel="noopener noreferrer"
          class="hidden sm:flex icon-btn" aria-label="TikTok">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.7 7.4c-1-1-1.6-2.3-1.7-3.7h-3v12c0 1.3-1 2.3-2.3 2.3-1.2 0-2.2-1-2.2-2.2 0-1.3 1-2.3 2.2-2.3.3 0 .6.1.9.2V9.3c-.3-.1-.6-.1-.9-.1C6.6 9.2 4 11.8 4 15c0 3.2 2.6 5.8 5.8 5.8 3.2 0 5.8-2.6 5.8-5.8V11c1.1.8 2.4 1.2 3.8 1.2V9.3c-1.1 0-2.2-.4-3-.9z"/>
          </svg>
        </a>

        <a href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer" class="btn-support">
          <svg width="18" height="18" fill="white" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <span class="btn-support-text">Aide</span>
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-[1280px] mx-auto px-4 py-8">

    <section class="mb-10">
      <article class="relative w-full h-[250px] md:h-[400px] rounded-[32px] overflow-hidden shadow-2xl group border-4 border-white">
        <img src="https://content.bsvmarket.com/uploads/banner_hero_20b30c28bd.png"
             class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
             alt="ViralFlowr"
             fetchpriority="high" decoding="async">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"></div>
        <div class="relative z-10 p-8 md:p-16 flex flex-col justify-end h-full text-white">
          <h1 class="text-3xl md:text-6xl font-black max-w-2xl leading-[0.95] mb-4 tracking-tighter uppercase italic">
            L'Univers Digital <br>& Matériel.
          </h1>
          <p class="text-xs md:text-lg font-medium opacity-90 max-w-md">
            Services Elite, Déblocage IMEI et Matériel High-Tech garantis.
          </p>
          <div id="priceMode" class="mt-4 text-[10px] font-black uppercase tracking-[0.18em] opacity-90">
            Mode: ...
          </div>
        </div>
      </article>
    </section>

    <div class="flex items-center gap-3 overflow-x-auto no-scrollbar pb-6 mb-10 border-b border-gray-100" id="catNav">
      <button type="button" onclick="filterCat('all', this)"
        class="cat-btn active brand-gradient text-white px-8 py-3 rounded-2xl text-[12px] font-black shadow-sm whitespace-nowrap transition-all uppercase">
        Tous
      </button>
      <button type="button" onclick="filterCat('Materiel', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        Matériel & Gadgets
      </button>
      <button type="button" onclick="filterCat('Abonnement', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        Abonnements
      </button>
      <button type="button" onclick="filterCat('Carte2', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        Cartes cadeaux
      </button>
      <button type="button" onclick="filterCat('IMEI', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        IMEI & Réseau
      </button>
      <button type="button" onclick="filterCat('Boost', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        Boost SMM
      </button>
      <button type="button" onclick="filterCat('Jeux', this)"
        class="cat-btn bg-white px-8 py-3 rounded-2xl text-[12px] font-black text-gray-500 shadow-sm whitespace-nowrap transition-all uppercase">
        Jeux
      </button>
    </div>

    <div id="loadError" class="hidden mb-6 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-2xl px-4 py-3"></div>

    <div id="product-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-24">
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
      <div class="h-64 bg-white rounded-3xl animate-pulse shadow-sm"></div>
    </div>

  </main>

  <footer class="bg-white border-t border-gray-100 py-12">
    <div class="max-w-[1280px] mx-auto px-4 flex flex-col items-center">
      <div class="text-2xl font-black tracking-tighter mb-6">
        Viral<span class="text-[#F07E13]">Flowr</span>
      </div>

      <div class="flex flex-wrap justify-center gap-8 mb-8 text-[11px] font-black uppercase text-gray-400 tracking-widest">
        <a href="/about.html" class="hover:text-gray-900">À Propos</a>
        <a href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer" class="hover:text-green-500">Contact Support</a>
        <a href="https://t.me/Viralflow" target="_blank" rel="noopener noreferrer" class="hover:text-blue-500">Telegram Community</a>
        <a href="https://www.instagram.com/di_corporation_1/" target="_blank" rel="noopener noreferrer" class="hover:text-pink-500">Instagram</a>
        <a href="https://www.tiktok.com/@dicorporation" target="_blank" rel="noopener noreferrer" class="hover:text-gray-900">TikTok</a>
      </div>

      <p class="text-[9px] text-gray-300 text-center max-w-lg leading-relaxed uppercase">
        © 2026 ViralFlowr Enterprise. Livraison garantie. Les marques citées appartiennent à leurs propriétaires.
      </p>
    </div>
  </footer>

  <script>
    // ========= CONFIG =========
    const SCRIPT_URL =
      (window.VF_CONFIG && window.VF_CONFIG.scriptUrl)
      ? String(window.VF_CONFIG.scriptUrl)
      : "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

    const FALLBACK_IMG = "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

    let ALL_PRODUCTS = [];
    let CURRENT_FILTER = "all";

    const FILTER_MAP = {
      "Abonnement": ["ABONNEMENT","CARTE"],
      "Carte2":     ["CARTE2"],
      "Boost":      ["BOOST","BOOST2","SMM1","SMM2","SMM3","PEAKERR","PEAK"],
      "Materiel":   ["MATERIEL","GADGET","PHONE"],
      "IMEI":       ["IMEI"],
      "Jeux":       ["JEUX","JEU","GAME","GAMING","PSN","PLAYSTATION","XBOX","STEAM","NINTENDO"]
    };

    // ========= UI SEARCH PLACEHOLDER =========
    const input = document.getElementById("searchInput");
    const placeholderBox = document.getElementById("placeholder-box");

    if (input && placeholderBox) {
      const syncPlaceholder = () => {
        const has = (input.value || "").trim().length > 0;
        placeholderBox.style.display = has ? "none" : "block";
      };

      input.addEventListener("focus", () => { placeholderBox.style.display = "none"; });
      input.addEventListener("blur", () => syncPlaceholder());
      input.addEventListener("input", () => { syncPlaceholder(); render(); });

      syncPlaceholder();
    }

    // ========= HELPERS =========
    function safe(v){ return (v === null || v === undefined) ? "" : String(v); }
    function up(v){ return safe(v).trim().toUpperCase(); }

    function escHtml(str){
      return safe(str).replace(/[&<>"']/g, (c) => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      }[c]));
    }

    function sanitizeHttpUrl(u){
      const s = safe(u).trim();
      if (!s) return "";
      if (/^https?:\/\//i.test(s)) return s;
      return "";
    }

    function pName(p){ return safe(p.nom || p.name || p.title); }
    function pCat(p){ return safe(p.cat || p.category || p.categorie); }

    function pPrice(p){
      return safe(
        (p && (
          p.prix_affiche ??
          p.prix_revendeur ??
          p.RESELLER ?? p.reseller ??
          p.prix ??
          p.price ??
          p.amount ??
          p.PV ?? p.pv ??
          p.prix_client
        ))
      );
    }

    function pImg(p){ return safe(p.img || p.image || p.photo); }
    function pMin(p){ return safe(p.min || p.minqnt || p.minQty || p.min_qty); }
    function pMax(p){ return safe(p.max || p.maxqnt || p.maxQty || p.max_qty); }

    // ========= STORAGE / TOKEN =========
    function getStore(){
      return (window.vfApi && window.vfApi.storage) ? window.vfApi.storage
           : (window.vfStorage ? window.vfStorage : null);
    }

    function getSession_(){
      const st = getStore();
      try{
        if (st && typeof st.getSession === "function") return st.getSession();
      }catch(_){}
      try{
        const raw = localStorage.getItem("vf_session");
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || (!s.email && !s.username)) return null;
        return s;
      }catch(_){ return null; }
    }

    function getCookie_(name){
      try{
        const m = document.cookie.match(new RegExp("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)"));
        return m ? decodeURIComponent(m[2]) : "";
      }catch(_){ return ""; }
    }

    function getToken_(){
      const st = getStore();

      try{
        if (st && typeof st.getToken === "function"){
          const t = st.getToken();
          if (t) return String(t).trim();
        }
      }catch(_){}

      try{
        const t2 = localStorage.getItem("vf_token");
        if (t2) return String(t2).trim();
      }catch(_){}

      const ck = getCookie_("vf_token");
      if (ck) {
        try { localStorage.setItem("vf_token", ck); } catch(_){}
        return String(ck).trim();
      }

      return "";
    }

    function clearSession_(){
      const st = getStore();
      try{ if (st && typeof st.clear === "function") st.clear(); }catch(_){}
      try{ localStorage.removeItem("vf_token"); }catch(_){}
      try{ localStorage.removeItem("vf_session"); }catch(_){}
      try{ localStorage.setItem("vf_session_changed", String(Date.now())); }catch(_){}
    }

    // ========= ACCOUNT UI =========
    function renderAccountUI_(){
      const area = document.getElementById("accountArea");
      const s = getSession_();
      const token = getToken_();
      const mode = document.getElementById("priceMode");

      if (!area) return;

      area.innerHTML = "";
      area.classList.remove("hidden");

      if (mode){
        mode.textContent = token ? "Mode: REVENDEUR (token détecté)" : "Mode: CLIENT (pas de token)";
      }

      if (!s){
        area.innerHTML = `
          <a href="/login.html" class="btn-auth btn-auth-outline">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <path d="M10 17l5-5-5-5"></path>
              <path d="M15 12H3"></path>
            </svg>
            Connexion
          </a>
          <a href="/register.html" class="btn-auth btn-auth-primary brand-gradient text-white shadow-md">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <path d="M20 8v6"></path>
              <path d="M23 11h-6"></path>
            </svg>
            Inscription
          </a>
        `;
        return;
      }

      const display = safe(s.username || s.email || "Compte");
      area.innerHTML = `
        <div class="hidden md:flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-2xl">
          <div class="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center text-white font-black text-sm">
            ${escHtml(display.slice(0,1).toUpperCase())}
          </div>
          <div class="leading-tight">
            <div class="text-[11px] font-black text-gray-900">Bonjour, ${escHtml(display)}</div>
            <div class="text-[9px] font-black uppercase tracking-widest ${token ? "text-green-400" : "text-gray-300"}">
              ${token ? "TOKEN OK" : "SANS TOKEN"}
            </div>
          </div>
        </div>
        <button id="logoutBtn" class="btn-auth btn-auth-outline" type="button">Déconnexion</button>
      `;

      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn){
        logoutBtn.addEventListener("click", () => {
          clearSession_();
          renderAccountUI_();
          start_();
        });
      }
    }

    // ========= LOADER / ERROR =========
    function showLoadError_(msg){
      const box = document.getElementById("loadError");
      if (!box) return;
      box.textContent = msg;
      box.classList.remove("hidden");
    }
    function hideLoadError_(){
      const box = document.getElementById("loadError");
      if (!box) return;
      box.classList.add("hidden");
      box.textContent = "";
    }

    // ========= PRODUCTS LOAD (JSONP) =========
    function initProducts(forcedToken){
      hideLoadError_();

      const old = document.getElementById("vf_products_loader");
      if (old) old.remove();

      const cbName = "vf_cb_" + Date.now() + "_" + Math.floor(Math.random()*1000000);
      window[cbName] = function(payload){
        try{
          if (payload && payload.error){
            showLoadError_("Erreur API produits: " + safe(payload.error));
            ALL_PRODUCTS = [];
          } else {
            ALL_PRODUCTS = Array.isArray(payload) ? payload : (Array.isArray(payload.products) ? payload.products : []);
          }
          render();
        } finally {
          try { delete window[cbName]; } catch(_){}
        }
      };

      const token = (typeof forcedToken === "string") ? forcedToken : getToken_();
      const tokenParam = token ? ("&token=" + encodeURIComponent(token)) : "";

      const s = document.createElement("script");
      s.id = "vf_products_loader";
      s.src = SCRIPT_URL + "?action=get_products" + tokenParam + "&callback=" + cbName + "&t=" + Date.now();
      s.onerror = () => {
        showLoadError_("Impossible de charger les produits (API). Vérifie ton déploiement Apps Script / doGet JSONP.");
        ALL_PRODUCTS = [];
        render();
        try { delete window[cbName]; } catch(_){}
      };
      document.body.appendChild(s);
    }

    // ========= FILTER =========
    function matchCatByFilter(productCatUpper, filterKey){
      if (filterKey === "all") return true;

      const allowed = FILTER_MAP[filterKey];
      if (!allowed) return (productCatUpper === up(filterKey));

      for (const a of allowed){
        const A = up(a);

        if (productCatUpper === A) return true;

        if (A === "IMEI" && productCatUpper.includes("IMEI")) return true;
        if ((A === "PEAKERR" || A === "PEAK") && (productCatUpper.includes("PEAK") || productCatUpper.includes("PEAKERR"))) return true;
        if (A.startsWith("SMM") && productCatUpper.includes("SMM")) return true;

        if (filterKey === "Jeux" && productCatUpper.includes(A)) return true;
      }
      return false;
    }

    function filterCat(cat, btn){
      document.querySelectorAll(".cat-btn").forEach(b=>{
        b.classList.remove("text-white","brand-gradient","active");
        b.classList.add("bg-white","text-gray-500");
      });

      if (btn){
        btn.classList.add("text-white","brand-gradient","active");
        btn.classList.remove("bg-white","text-gray-500");
      }

      CURRENT_FILTER = cat;
      render();
    }

    // ========= RENDER =========
    function render(){
      const grid = document.getElementById("product-grid");
      if (!grid) return;

      const query = (input ? (input.value || "") : "").toLowerCase().trim();

      const filtered = ALL_PRODUCTS.filter(p=>{
        const catU = up(pCat(p));
        const nameL = pName(p).toLowerCase();
        const catL  = pCat(p).toLowerCase();

        const matchCat = matchCatByFilter(catU, CURRENT_FILTER);
        const matchSearch =
          !query ||
          nameL.includes(query) ||
          catL.includes(query) ||
          safe(p.id).toLowerCase().includes(query);

        return matchCat && matchSearch;
      });

      if (filtered.length === 0){
        grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-300 font-bold uppercase">Aucun article trouvé</div>';
        return;
      }

      grid.innerHTML = filtered.map(p=>{
        const imgRaw = sanitizeHttpUrl(pImg(p));
        const img = imgRaw || FALLBACK_IMG;

        const priceRaw = pPrice(p);
        let priceTxt = "—";
        if (safe(priceRaw).trim() !== ""){
          const priceNum = parseFloat(String(priceRaw).replace(",", "."));
          priceTxt = Number.isFinite(priceNum) ? priceNum.toFixed(2) : safe(priceRaw);
        }

        const id = encodeURIComponent(safe(p.id).trim());

        /* ✅ CHEMIN CORRIGÉ :
           Pages générées en /p/<id>/index.html  -> on pointe directement dessus
           (et ça marche aussi si ton host ne gère pas bien le "trailing slash")
        */
        const productUrl = `/p/${id}/index.html`;

        const min = pMin(p);
        const max = pMax(p);

        return `
          <div onclick="location.href='${productUrl}'"
            class="hover-card product-card group bg-white rounded-[30px] p-4 border border-gray-50 flex flex-col cursor-pointer shadow-sm">
            <div class="aspect-square bg-[#F8FAFC] rounded-[22px] mb-4 flex items-center justify-center p-6 overflow-hidden">
              <img src="${img}"
                class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                loading="lazy" decoding="async"
                alt="${escHtml(pName(p) || "Produit")}"
                onerror="this.src='${FALLBACK_IMG}'">
            </div>
            <div class="px-1">
              <span class="text-[9px] font-black text-[#F07E13] uppercase tracking-tighter mb-1 block">${escHtml(pCat(p))}</span>
              <h3 class="text-[13px] font-bold text-gray-900 leading-tight mb-4 h-8 overflow-hidden line-clamp-2">${escHtml(pName(p))}</h3>
              <div class="flex items-center justify-between">
                <span class="text-gray-900 font-black text-lg tracking-tighter">${escHtml(priceTxt)} $</span>
                <div class="plus-badge text-white p-1.5 rounded-lg">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4"></path>
                  </svg>
                </div>
              </div>

              ${(min || max) ? `
                <div class="mt-3 text-[9px] font-black uppercase tracking-widest text-gray-300">
                  Min ${escHtml(safe(min) || "-")} • Max ${escHtml(safe(max) || "-")}
                </div>` : ``}
            </div>
          </div>
        `;
      }).join("");
    }

    // ========= ANTI-FLASH PRIX =========
    function _sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

    async function waitForTokenOrTimeout_(timeoutMs){
      const start = Date.now();
      let t = getToken_();
      while(!t && (Date.now() - start) < timeoutMs){
        await _sleep(120);
        t = getToken_();
      }
      return t;
    }

    async function start_(){
      renderAccountUI_();

      const hasSession = !!getSession_();
      const token = await waitForTokenOrTimeout_(hasSession ? 1200 : 0);

      initProducts(token);

      setTimeout(() => {
        const t2 = getToken_();
        if (t2 && t2 !== token) initProducts(t2);
      }, 900);
    }

    // ========= SYNC ONGLET =========
    window.addEventListener("storage", (e)=>{
      if (e.key === "vf_session" || e.key === "vf_token" || e.key === "vf_session_changed"){
        start_();
      }
    });

    // ========= START =========
    start_();
  </script>
</body>
</html>
