(function () {
  let savedScrollY = 0;

  function getMenuHTML() {
    return `
      <div id="vfMenuOverlay" class="vf-menu-overlay" aria-hidden="true"></div>

      <aside id="vfSideMenu" class="vf-side-menu" aria-hidden="true">
        <div class="vf-side-menu__header">
          <div>
            <div class="vf-side-menu__brand">Viral<span>Flowr</span></div>
            <div class="vf-side-menu__sub">Navigation</div>
          </div>

          <button type="button" class="vf-side-menu__close" aria-label="Fermer le menu" data-vf-close>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="vf-side-menu__body">
          <nav class="flex flex-col gap-1" aria-label="Navigation principale">
            <div class="vf-side-menu__section">Général</div>

            <a href="/index.html" class="vf-menu-link" data-path="/index.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Boutique</span>
            </a>

            <a href="/wallet.html" class="vf-menu-link" data-path="/wallet.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2M20 12h-4a2 2 0 0 0 0 4h4"/>
              </svg>
              <span>Mon Portefeuille</span>
            </a>

            <a href="/commandes.html" class="vf-menu-link" data-path="/commandes.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>
              </svg>
              <span>Mes Commandes</span>
            </a>

            <div class="vf-side-menu__sep"></div>

            <div class="vf-side-menu__section">Développeurs & Infos</div>

            <a href="/api-access.html" class="vf-menu-link" data-path="/api-access.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              <span>Accès API (Revendeurs)</span>
            </a>

            <a href="/politique.html" class="vf-menu-link" data-path="/politique.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Politique de règlement</span>
            </a>

            <a href="/about.html" class="vf-menu-link" data-path="/about.html">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
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

  function injectMenu() {
    if (document.getElementById("vfSideMenu")) return;
    document.body.insertAdjacentHTML("beforeend", getMenuHTML());
  }

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
    if (menu.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function bindMenuEvents() {
    document.addEventListener("click", function (e) {
      const trigger = e.target.closest("[data-vf-menu-trigger]");
      const closeBtn = e.target.closest("[data-vf-close]");
      const overlay = e.target.closest("#vfMenuOverlay");
      const link = e.target.closest("#vfSideMenu a");

      if (trigger) {
        e.preventDefault();
        toggleMenu();
        return;
      }

      if (closeBtn || overlay) {
        e.preventDefault();
        closeMenu();
        return;
      }

      if (link) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMenu();
      }
    });
  }

  function setActiveLink() {
    const current = location.pathname.toLowerCase();
    document.querySelectorAll(".vf-menu-link").forEach((link) => {
      const path = (link.getAttribute("data-path") || "").toLowerCase();
      const isHome = current === "/" && path === "/index.html";
      const isMatch = current === path || isHome;
      link.classList.toggle("active", isMatch);
    });
  }

  function initVFMenu() {
    injectMenu();
    bindMenuEvents();
    setActiveLink();
  }

  window.VFMenu = {
    init: initVFMenu,
    open: openMenu,
    close: closeMenu,
    toggle: toggleMenu
  };

  document.addEventListener("DOMContentLoaded", initVFMenu);
})();
