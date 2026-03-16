(function () {
  let savedScrollY = 0;

  // 1. Définition du HTML et CSS combiné (Header + Side Menu)
  function getNavigationHTML() {
    return `
      <style>
        .vf-menu-open { overflow: hidden; touch-action: none; }
        
        /* HEADER STYLES */
        .vf-header { background: white; position: sticky; top: 0; width: 100%; z-index: 50; border-bottom: 1px solid #f3f4f6; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); backdrop-filter: blur(12px); background-color: rgba(255, 255, 255, 0.95); }
        .vf-header-container { max-width: 1280px; margin: 0 auto; padding: 0 16px; height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .vf-brand-wrap { display: flex; align-items: center; gap: 8px; text-decoration: none; flex-shrink: 0; }
        .vf-brand-text { font-size: 24px; font-weight: 900; letter-spacing: -0.05em; color: #111827; }
        .vf-brand-text span { color: #F07E13; }
        .vf-menu-trigger-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 14px; background: transparent; border: none; color: #374151; transition: 0.2s; cursor: pointer; flex-shrink: 0; }
        .vf-menu-trigger-btn:hover { background: #f9fafb; color: #F07E13; }
        
        /* RECHERCHE (Uniquement affiché si activé) */
        .vf-search-container { position: relative; flex: 1; max-width: 600px; display: none; align-items: center; }
        @media (min-width: 768px) { .vf-search-container { display: flex; } }
        .vf-search-input { width: 100%; height: 44px; padding-left: 20px; padding-right: 48px; border-radius: 12px; background: #F1F5F9; font-size: 14px; font-weight: 600; border: none; outline: none; transition: all 0.2s; }
        .vf-search-input:focus { box-shadow: 0 0 0 2px #F07E13; }
        .vf-search-placeholder { position: absolute; left: 20px; pointer-events: none; color: #9CA3AF; font-size: 14px; font-weight: 600; transition: opacity 0.2s; }
        @keyframes vfPlaceholderAnimate { 0% { opacity: 0; transform: translateY(8px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-8px); } }
        .vf-animate-text { animation: vfPlaceholderAnimate 4s infinite; display: inline-block; }
        
        /* HEADER RIGHT */
        .vf-header-right { display: flex; align-items: center; gap: 8px; }
        .vf-btn-support { background: #25D366; color: white; padding: 8px 16px; border-radius: 12px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; transition: 0.3s; flex-shrink: 0; }
        .vf-btn-support:hover { transform: scale(1.05); box-shadow: 0 10px 15px -3px rgba(37, 211, 102, 0.3); }

        /* SIDE MENU STYLES */
        .vf-side-menu { position: fixed; top: 0; left: 0; height: 100dvh; width: min(86vw, 320px); max-width: 320px; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18); border-right: 1px solid rgba(229, 231, 235, 0.9); z-index: 70; display: flex; flex-direction: column; overflow: hidden; transform: translate3d(-104%, 0, 0); transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
        .vf-side-menu.open { transform: translate3d(0, 0, 0); }
        .vf-menu-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(2, 6, 23, 0.42); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.28s ease, visibility 0.28s ease; }
        .vf-menu-overlay.open { opacity: 1; visibility: visible; pointer-events: auto; }
        .vf-side-menu__header { position: sticky; top: 0; z-index: 2; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(16px); border-bottom: 1px solid #F1F5F9; padding: 20px; display: flex; align-items: center; justify-content: space-between; }
        .vf-side-menu__brand { font-size: 24px; font-weight: 900; letter-spacing: -0.05em; color: #111827; }
        .vf-side-menu__brand span { color: #F07E13; }
        .vf-side-menu__sub { font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 4px; }
        .vf-side-menu__close { width: 40px; height: 40px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; background: #F8FAFC; color: #6B7280; border: 1px solid #EEF2F7; cursor: pointer; transition: all 0.2s ease; }
        .vf-side-menu__close:hover { background: #FFF7ED; color: #F07E13; border-color: #FED7AA; transform: rotate(90deg); }
        .vf-side-menu__body { flex: 1; overflow-y: auto; padding: 14px; }
        .vf-side-menu__section { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; color: #9CA3AF; padding: 10px 14px 8px; }
        .vf-menu-link { display: flex; align-items: center; gap: 14px; padding: 14px; min-height: 54px; border-radius: 18px; color: #111827; font-weight: 800; font-size: 14px; line-height: 1.1; text-decoration: none; transition: all 0.22s ease; position: relative; }
        .vf-menu-link svg { color: #9CA3AF; transition: all 0.22s ease; flex-shrink: 0; }
        .vf-menu-link:hover { background: #F8FAFC; color: #F07E13; transform: translateX(4px); box-shadow: inset 0 0 0 1px #FDE7D1; }
        .vf-menu-link:hover svg { color: #F07E13; transform: scale(1.04); }
        .vf-menu-link.active { background: linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%); color: #F07E13; box-shadow: inset 0 0 0 1px #FDE7D1; }
        .vf-menu-link.active svg { color: #F07E13; }
        .vf-side-menu__sep { height: 1px; background: #F1F5F9; margin: 16px 8px; }
        .vf-side-menu__footer { border-top: 1px solid #F1F5F9; background: linear-gradient(to top, #F8FAFC, #FFFFFF); padding: 18px; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
        
        @media (max-width: 420px) {
          .vf-brand-text { font-size: 22px; }
          .vf-btn-support span { display: none; }
          .vf-btn-support { padding: 8px 10px; border-radius: 12px; }
        }
      </style>

      <header class="vf-header" id="vfHeader">
        <div class="vf-header-container">
          <div class="flex items-center gap-3">
            <button type="button" class="vf-menu-trigger-btn" aria-label="Menu" aria-expanded="false" data-vf-menu-trigger>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <a href="/index.html" class="vf-brand-wrap" aria-label="ViralFlowr">
              <div class="vf-brand-text">Viral<span>Flowr</span></div>
            </a>
          </div>

          <div class="vf-search-container" id="vfSearchContainer">
            <input type="text" id="searchInput" class="vf-search-input">
            <div id="placeholder-box" class="vf-search-placeholder">
              <span id="animated-placeholder" class="vf-animate-text">Que cherchez-vous ? (SMM, iPhone, IMEI...)</span>
            </div>
          </div>

          <div class="vf-header-right">
            <div id="accountArea" class="hidden sm:flex items-center gap-2"></div>
            <a href="https://wa.me/243838694889" target="_blank" rel="noopener noreferrer" class="vf-btn-support">
              <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
              <span>Aide</span>
            </a>
          </div>
        </div>
      </header>

      <div id="vfMenuOverlay" class="vf-menu-overlay" aria-hidden="true" data-vf-close></div>

      <aside id="vfSideMenu" class="vf-side-menu" aria-hidden="true">
        <div class="vf-side-menu__header">
          <div>
            <div class="vf-side-menu__brand">Viral<span>Flowr</span></div>
            <div class="vf-side-menu__sub">Navigation</div>
          </div>
          <button type="button" class="vf-side-menu__close" aria-label="Fermer le menu" data-vf-close>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="vf-side-menu__body">
          <nav class="flex flex-col gap-1" aria-label="Navigation principale">
            <div class="vf-side-menu__section">Général</div>
            <a href="/index.html" class="vf-menu-link" data-path="/index.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              <span>Boutique</span>
            </a>
            <a href="/wallet.html" class="vf-menu-link" data-path="/wallet.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2M20 12h-4a2 2 0 0 0 0 4h4"/></svg>
              <span>Mon Portefeuille</span>
            </a>
            <a href="/commandes.html" class="vf-menu-link" data-path="/commandes.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>
              <span>Mes Commandes</span>
            </a>
            <div class="vf-side-menu__sep"></div>
            <div class="vf-side-menu__section">Développeurs & Infos</div>
            <a href="/api-access.html" class="vf-menu-link" data-path="/api-access.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
              <span>Accès API (Revendeurs)</span>
            </a>
            <a href="/politique.html" class="vf-menu-link" data-path="/politique.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <span>Politique de règlement</span>
            </a>
            <a href="/about.html" class="vf-menu-link" data-path="/about.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>À propos de nous</span>
            </a>
          </nav>
        </div>

        <div class="vf-side-menu__footer">
          <div id="sideAccountArea"></div>
        </div>
      </aside>
    `;
  }

  // 2. Injection dans le DOM
  function injectNavigation() {
    if (document.getElementById("vfHeader")) return; // Évite les doublons
    
    // On l'injecte juste au début du body
    document.body.insertAdjacentHTML("afterbegin", getNavigationHTML());
  }

  // 3. Logique d'ouverture / fermeture (Identique)
  function openMenu() {
    const menu = document.getElementById("vfSideMenu");
    const overlay = document.getElementById("vfMenuOverlay");
    const triggers = document.querySelectorAll("[data-vf-menu-trigger]");
    if (!menu || !overlay) return;

    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("vf-menu-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    menu.classList.add("open");
    overlay.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");
    triggers.forEach((btn) => btn.setAttribute("aria-expanded", "true"));
  }

  function closeMenu() {
    const menu = document.getElementById("vfSideMenu");
    const overlay = document.getElementById("vfMenuOverlay");
    const triggers = document.querySelectorAll("[data-vf-menu-trigger]");
    if (!menu || !overlay) return;

    menu.classList.remove("open");
    overlay.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");

    document.body.classList.remove("vf-menu-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, savedScrollY);
    triggers.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  }

  function toggleMenu() {
    const menu = document.getElementById("vfSideMenu");
    if (!menu) return;
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  }

  // 4. Événements et UI dynamique
  function bindMenuEvents() {
    document.addEventListener("click", function (e) {
      const trigger = e.target.closest("[data-vf-menu-trigger]");
      const closeBtn = e.target.closest("[data-vf-close]");
      const link = e.target.closest("#vfSideMenu a");

      if (trigger) { e.preventDefault(); toggleMenu(); return; }
      if (closeBtn) { e.preventDefault(); closeMenu(); return; }
      if (link) { closeMenu(); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  function setActiveLink() {
    const current = location.pathname.toLowerCase();
    document.querySelectorAll(".vf-menu-link").forEach((link) => {
      const path = (link.getAttribute("data-path") || "").toLowerCase();
      const isHome = (current === "/" || current === "") && path === "/index.html";
      const isMatch = current.includes(path) || isHome;
      link.classList.toggle("active", isMatch);
    });
  }

  function configureSearchBox() {
    const searchContainer = document.getElementById("vfSearchContainer");
    const inputEl = document.getElementById("searchInput");
    const box = document.getElementById("placeholder-box");
    
    // N'afficher la barre de recherche QUE sur la page d'accueil / boutique
    const current = location.pathname.toLowerCase();
    if (current === "/" || current === "/index.html" || current === "") {
        if(searchContainer) searchContainer.style.display = "flex";
    } else {
        if(searchContainer) searchContainer.style.display = "none";
    }

    if (inputEl && box) {
      function syncPlaceholder() { box.style.opacity = inputEl.value.trim() ? "0" : "1"; }
      inputEl.addEventListener("focus", syncPlaceholder);
      inputEl.addEventListener("input", syncPlaceholder);
      inputEl.addEventListener("blur", syncPlaceholder);
      syncPlaceholder();
    }
  }

  // 5. Initialisation
  function initVFNavigation() {
    injectNavigation();
    bindMenuEvents();
    setActiveLink();
    configureSearchBox();
  }

  // On expose les méthodes si besoin
  window.VFMenu = {
    init: initVFNavigation,
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu
  };

  // Lancement automatique !
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVFNavigation);
  } else {
    initVFNavigation();
  }

})();
