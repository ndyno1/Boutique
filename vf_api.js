
/** ===========================
 *  VF API CLIENT (NO CORS) — UPDATED (KEEP LOGIC)
 *  - GET  => JSONP (script tag)
 *  - POST => hidden iframe form + postMessage
 *  - Robust: body-ready, per-request iframe, timeouts, strict source check
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  // --- Config
  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  let VF_SCRIPT_URL = String(
    CFG.scriptUrl ||
    CFG.apiBase ||
    "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec"
  ).trim();

  const DEFAULT_TIMEOUT = Number(CFG.timeoutMs || 20000);
  const DEBUG = !!CFG.debug;

  // --- Helpers
  const nowId_ = () => Date.now() + "-" + Math.floor(Math.random() * 1e6);

  const safeJsonParse_ = (x) => {
    try { return (typeof x === "string") ? JSON.parse(x) : x; }
    catch (_) { return x; }
  };

  const isAllowedOrigin_ = (origin) => {
    const o = String(origin || "");
    // file:// => origin "null"
    if (o === "null" && (location.protocol === "file:" || location.origin === "null")) return true;

    return (
      o === "https://script.google.com" ||
      o === "https://script.googleusercontent.com" ||
      o.endsWith(".googleusercontent.com")
    );
  };

  const isTrustedHostForStrictOrigin_ = () => {
    const host = String(location.hostname || "").toLowerCase();
    return (
      host === "viralflowr.com" ||
      host.endsWith(".viralflowr.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  };

  // origin qu'on envoie au serveur (qui servira de targetOrigin côté postMessage serveur)
  const pickClientOriginParam_ = () => {
    // Si tu veux forcer, tu peux faire VF_CONFIG.postMessageTargetOrigin = "*"
    if (CFG.postMessageTargetOrigin) return String(CFG.postMessageTargetOrigin);

    // Sur viralflowr/localhost => strict = location.origin
    if (isTrustedHostForStrictOrigin_()) return String(location.origin);

    // Dans des previews/panels (googleusercontent etc.) => "*" évite targetOrigin mismatch
    return "*";
  };

  function ensureBody_(fn){
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once:true });
  }

  // Pending requests by request_id
  // Map<rid, { resolve, reject, timer, iframe }>
  const pending = new Map();

  function cleanupReq_(rid){
    const p = pending.get(rid);
    if (!p) return;

    if (p.timer) clearTimeout(p.timer);

    try { if (p.form && p.form.parentNode) p.form.parentNode.removeChild(p.form); } catch(_) {}
    try { if (p.iframe && p.iframe.parentNode) p.iframe.parentNode.removeChild(p.iframe); } catch(_) {}

    pending.delete(rid);
  }

  function settle_(rid, kind, data){
    const p = pending.get(rid);
    if (!p) return;

    cleanupReq_(rid);

    if (kind === "resolve") p.resolve(data);
    else p.reject(data);
  }

  // Listen responses (postMessage from Apps Script HTML bridge)
  window.addEventListener("message", (event) => {
    if (!isAllowedOrigin_(event.origin)) return;

    const msg = safeJsonParse_(event.data);
    if (!msg || typeof msg !== "object") return;

    const rid = msg.request_id || msg.requestId;
    if (!rid || !pending.has(rid)) return;

    // Vérifie que ça vient du BON iframe lié à ce rid
    const p = pending.get(rid);
    if (p && p.iframe && event.source && p.iframe.contentWindow && event.source !== p.iframe.contentWindow) {
      return;
    }

    if (DEBUG) console.log("[vfBridge] message ok rid=", rid, msg);

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

      let script = null;

      const cleanup = () => {
        try { delete window[cb]; } catch(_) {}
        try { if (script && script.parentNode) script.parentNode.removeChild(script); } catch(_) {}
      };

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("JSONP_TIMEOUT"));
      }, timeoutMs);

      window[cb] = (data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve(data);
      };

      const qs = new URLSearchParams({ action, callback: cb, ...(params || {}) });
      script = document.createElement("script");
      script.src = VF_SCRIPT_URL + "?" + qs.toString();
      script.async = true;

      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error("JSONP_ERROR"));
      };

      document.head.appendChild(script);
    });
  }

  // --------------------------
  // POST (iframe + postMessage)
  // --------------------------
  function vfPost(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      ensureBody_(() => {
        if (!VF_SCRIPT_URL) return reject(new Error("SCRIPT_URL_MISSING"));

        const rid = "REQ-" + nowId_();

        // 1 iframe par request => pas de collision
        const ifr = document.createElement("iframe");
        ifr.name = "vf_iframe_" + rid;
        ifr.id   = "vf_iframe_" + rid;
        ifr.style.display = "none";
        // About:blank hérite de l'origin du parent (ok)
        ifr.src = "about:blank";
        document.body.appendChild(ifr);

        const timer = setTimeout(() => {
          if (!pending.has(rid)) return;
          cleanupReq_(rid);
          reject(new Error("IFRAME_TIMEOUT"));
        }, timeoutMs);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = VF_SCRIPT_URL;
        form.target = ifr.name;

        const add = (k, v) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = (v === undefined || v === null) ? "" : String(v);
          form.appendChild(input);
        };

        // mandatory bridge fields
        add("transport", "iframe");
        add("origin", pickClientOriginParam_()); // <-- MAJ: évite targetOrigin mismatch en preview
        add("request_id", rid);

        // payload fields
        Object.keys(payload || {}).forEach((k) => add(k, payload[k]));

        pending.set(rid, { resolve, reject, timer, iframe: ifr, form });

        document.body.appendChild(form);

        if (DEBUG) console.log("[vfBridge] POST rid=", rid, "payload=", payload);

        try {
          form.submit();
        } catch (e) {
          cleanupReq_(rid);
          reject(e);
          return;
        }

        // nettoyage form (l'iframe reste jusqu'à la réponse ou timeout)
        setTimeout(() => { try { if (form && form.parentNode) form.parentNode.removeChild(form); } catch(_) {} }, 1500);
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

    createOrder: (data) => vfPost({ ...(data||{}) }),
    chatSupport: ({ chat, orderId, email }) => vfPost({ chat, orderId, email }),

    // Utils
    setScriptUrl: (u) => { VF_SCRIPT_URL = String(u || "").trim(); },
    getScriptUrl: () => VF_SCRIPT_URL
  };

})();

