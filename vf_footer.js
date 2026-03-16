(function () {
  function getFooterHTML() {
    return `
      <footer id="vfFooter" class="bg-white border-t border-gray-100 py-12">
        <div class="max-w-[1280px] mx-auto px-4 flex flex-col items-center">
          <div class="text-2xl font-black tracking-tighter mb-6">
            Viral<span class="text-[#F07E13]">Flowr</span>
          </div>
          <p class="text-[9px] text-gray-300 text-center max-w-lg leading-relaxed uppercase">
            © 2026 ViralFlowr Enterprise. Livraison garantie.
          </p>
        </div>
      </footer>
    `;
  }

  function injectFooter() {
    if (document.getElementById("vfFooter")) return;
    document.body.insertAdjacentHTML("beforeend", getFooterHTML());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFooter);
  } else {
    injectFooter();
  }
})();
