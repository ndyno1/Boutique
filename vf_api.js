<script>
/** ===========================
 *  VF API CLIENT (NO CORS) — UPDATED
 *  - GET  => JSONP (script tag)
 *  - POST => hidden iframe form + postMessage
 *  - Robust: body-ready, timeouts, source check
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  // --- Config (tu peux aussi définir window.VF_CONFIG = { scriptUrl: "..." } avant ce script)
  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  let VF_SCRIPT_URL = String(
    CFG.scriptUrl ||
    CFG.apiBase || // alias si tu utilises déjà apiBase ailleurs
    "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec"
  ).trim();

  const DEFAULT_TIMEOUT = Number(CFG.timeoutMs || 20000);

  // --- Helpers
  const nowId_ = () => Date.now() + "-" + Math.floor(Math.random() * 1e6);

  const safeJsonParse_ = (x) => {
    try { return (typeof x === "string") ? JSON.parse(x) : x; } catch (_) { return x; }
  };

  const isAllowedOrigin_ = (origin) => {
    const o = String(origin || "");
    // En local file://, l'origin peut être "null"
    if (o === "null" && (location.protocol === "file:" || location.origin === "null")) return true;

    return (
      o === "https://script.google.com" ||
      o === "https://script.googleusercontent.com" ||
      o.endsWith(".googleusercontent.com")
    );
  };

  function ensureBody_(fn){
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once:true });
  }

  // --- iframe transport
  let iframe = null;
  function ensureIframe_(){
    if (iframe && document.getElementById("vf_iframe")) return iframe;

    iframe = document.createElement("iframe");
    iframe.name = "vf_iframe";
    iframe.id = "vf_iframe";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    return iframe;
  }

  // Pending requests by request_id
  const pending = new Map();

  function settle_(rid, kind, data){
    const p = pending.get(rid);
    if (!p) return;
    pending.delete(rid);
    if (p.timer) clearTimeout(p.timer);

    if (kind === "resolve") p.resolve(data);
    else p.reject(data);
  }

  // Listen responses (postMessage from Apps Script HTML bridge)
  window.addEventListener("message", (event) => {
    if (!isAllowedOrigin_(event.origin)) return;

    // Vérifie que ça vient de NOTRE iframe (si elle existe)
    const ifr = document.getElementById("vf_iframe");
    if (ifr && event.source && ifr.contentWindow && event.source !== ifr.contentWindow) return;

    const msg = safeJsonParse_(event.data);
    if (!msg || typeof msg !== "object") return;

    const rid = msg.request_id;
    if (!rid || !pending.has(rid)) return;

    settle_(rid, "resolve", msg);
  });

  // --------------------------
  // JSONP (GET)
  // --------------------------
  function vfJsonp(action, params = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      if (!VF_SCRIPT_URL) return reject(new Error("SCRIPT_URL_MISSING"));

      const cb = "__vf_cb_" + nowId_().replace(/[^a-zA-Z0-9_]/g, "_");
      let done = false;

      const cleanup = (script) => {
        try { delete window[cb]; } catch(_) {}
        try { if (script && script.parentNode) script.parentNode.removeChild(script); } catch(_) {}
      };

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup(script);
        reject(new Error("JSONP_TIMEOUT"));
      }, timeoutMs);

      window[cb] = (data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup(script);
        resolve(data);
      };

      const qs = new URLSearchParams({ action, callback: cb, ...params });
      const script = document.createElement("script");
      script.src = VF_SCRIPT_URL + "?" + qs.toString();
      script.async = true;

      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup(script);
        reject(new Error("JSONP_ERROR"));
      };

      document.head.appendChild(script);
    });
  }

  // --------------------------
  // POST (iframe)
  // --------------------------
  function vfPost(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      ensureBody_(() => {
        if (!VF_SCRIPT_URL) return reject(new Error("SCRIPT_URL_MISSING"));

        ensureIframe_();

        const rid = "REQ-" + nowId_();

        const timer = setTimeout(() => {
          if (!pending.has(rid)) return;
          pending.delete(rid);
          reject(new Error("IFRAME_TIMEOUT"));
        }, timeoutMs);

        pending.set(rid, { resolve, reject, timer });

        const form = document.createElement("form");
        form.method = "POST";
        form.action = VF_SCRIPT_URL;
        form.target = "vf_iframe";

        const add = (k, v) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = (v === undefined || v === null) ? "" : String(v);
          form.appendChild(input);
        };

        // mandatory bridge fields (doit être géré côté Apps Script)
        add("transport", "iframe");
        add("origin", location.origin);
        add("request_id", rid);

        // payload fields
        Object.keys(payload || {}).forEach((k) => add(k, payload[k]));

        document.body.appendChild(form);
        form.submit();

        // nettoyage rapide du form
        setTimeout(() => { try { form.remove(); } catch(_) {} }, 1500);
      });
    });
  }

  // Expose helpers
  window.vfJsonp = vfJsonp;
  window.vfPost  = vfPost;

  // High-level API (inchangé)
  window.vfApi = {
    // GET (JSONP)
    getProducts: ({ cat="all", token="" } = {}) => vfJsonp("get_products", { cat, token }),
    orderHistory: ({ email, limit=80 } = {}) => vfJsonp("order_history", { email, limit }),

    // POST (iframe)
    register: ({ username, email, password }) => vfPost({ action:"register", username, email, password }),
    login:    ({ email, password }) => vfPost({ action:"login", email, password }),

    walletBalance:     ({ token, currency="USD" }) => vfPost({ action:"db_wallet_balance", token, currency }),
    walletTopupCreate: (data) => vfPost({ action:"db_wallet_topup_create", ...(data||{}) }),

    walletPay:   (data) => vfPost({ action:"wallet_pay", ...(data||{}) }),
    resellerPay: (data) => vfPost({ action:"reseller_pay", ...(data||{}) }),

    createOrder: (data) => vfPost({ ...(data||{}) }), // si tu n’envoies pas "action", ça passe par recevoir() côté serveur
    chatSupport: ({ chat, orderId, email }) => vfPost({ chat, orderId, email }),

    // Utils
    setScriptUrl: (u) => { VF_SCRIPT_URL = String(u || "").trim(); },
    getScriptUrl: () => VF_SCRIPT_URL
  };

  // Init iframe early (quand body prêt)
  ensureBody_(() => ensureIframe_());
})();
</script>
