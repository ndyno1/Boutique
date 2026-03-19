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

  SUPABASE_URL: "https://hipaxukrnqqhwwulpdcq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcGF4dWtybnFxaHd3dWxwZGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjA0MzIsImV4cCI6MjA4OTM5NjQzMn0.MWDryLC0xedkcD3RzuRRUpNaLLoQV6gA0wsv2FNe0E0",

  timeoutMs: 25000,
  debug: false,
  proxyUrl: "/vf_proxy",
  cookieDomain: ".viralflowr.com",
  cookieTokenKey: "vf_token"
};

// 1. Pour le navigateur
if (typeof window !== "undefined") {
  window.VF_CONFIG = VF_SHARED_CONFIG;
}

// 2. Pour Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = VF_SHARED_CONFIG;
}