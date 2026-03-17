const VF_SHARED_CONFIG = {
  brandName: "ViralFlowr",
  companyName: "DI corporation",
  canonHost: "viralflowr.com",

  supportEmail: "viralflowr@gmail.com",
  whatsappNumber: "243838694889",
  whatsappUrl: "https://wa.me/243838694889",
  telegramUrl: "https://t.me/Viralflow",

  SITE_BASE: "https://viralflowr.com",
  VF_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec",

  scriptUrl: "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec",
  avisScriptUrl: "https://script.google.com/macros/s/AKfycbylffBPr9m8Y26asnlPuVDizwS5xOUe9zpUIt3NrbUZlVsMgNkh9bOcANYbkvTZbpL9/exec",
  orderScriptUrl: "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec",

  timeoutMs: 25000,
  debug: false,
  proxyUrl: "/vf_proxy",
  cookieDomain: ".viralflowr.com",
  cookieTokenKey: "vf_token"
};

(function () {
  if (typeof window === "undefined") return;

  const ref = document.referrer || "";
  const inAppsScriptPanel = /script\.googleusercontent\.com|script\.google\.com/i.test(ref);

  window.VF_CONFIG = {
    ...VF_SHARED_CONFIG,
    inAppsScriptPanel: inAppsScriptPanel,
    postMessageTargetOrigin: inAppsScriptPanel ? "*" : location.origin
  };
})();
