/** ===========================
 * VF API CLIENT — ADAPTÉ V18.5 (Apps Script)
 * - Support complet de l'adresse IP (user_ip)
 * - Routage automatique via Iframe pour éviter les erreurs CORS
 * - Compatible VIRALFLOWR
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  // --------------------------
  // Config
  // --------------------------
  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};

  const VF_SCRIPT_URL = String(
    CFG.scriptUrl ||
    "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec"
  ).trim();

  const DEFAULT_TIMEOUT = Number(CFG.timeoutMs || 25000);
  const DEBUG = !!CFG.debug;

  // postMode forcé sur "iframe" pour Apps Script si pas de proxy
  const POST_MODE = String(CFG.postMode || "iframe").toLowerCase();
  const PROXY_URL = CFG.proxyUrl ? String(CFG.proxyUrl).trim() : "";
  const AUTO_STORE_AUTH = (CFG.autoStoreAuth !== false);

  const nowId_ = () => Date.now() + "-" + Math.floor(Math.random() * 1e6);

  const safeJsonParse_ = (x) => {
    try { return (typeof x === "string") ? JSON.parse(x) : x; }
    catch (_) { return x; }
  };

  // --------------------------
  // Origin & Body Helpers
  // --------------------------
  const pickClientOriginParam_ = () => {
    if (CFG.postMessageTargetOrigin) return String(CFG.postMessageTargetOrigin);
    return String(location.origin);
  };

  function ensureBody_(fn){
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once:true });
  }

  // --------------------------
  // Storage (ViralFlowr)
  // --------------------------
  const vfStorage = {
    getToken(){ return localStorage.getItem("vf_token") || ""; },
    setToken(t){ 
      if(t) localStorage.setItem("vf_token", t); 
      else localStorage.removeItem("vf_token");
    },
    getSession(){
      try { return JSON.parse(localStorage.getItem("vf_session") || "null"); } catch(_){ return null; }
    },
    setSession(s){
      if (s) localStorage.setItem("vf_session", JSON.stringify(s));
      else localStorage.removeItem("vf_session");
      localStorage.setItem("vf_session_changed", String(Date.now()));
    },
    clear(){
      localStorage.removeItem("vf_token");
      localStorage.removeItem("vf_session");
      localStorage.removeItem("vf_session_changed");
    }
  };
  window.vfStorage = vfStorage;

  // --------------------------
  // Communication (Iframe / postMessage)
  // --------------------------
  const pending = new Map();

  function cleanupReq_(rid){
    const p = pending.get(rid);
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    try { if (p.form && p.form.parentNode) p.form.parentNode.removeChild(p.form); } catch(_) {}
    try { if (p.iframe && p.iframe.parentNode) p.iframe.parentNode.removeChild(p.iframe); } catch(_) {}
    pending.delete(rid);
  }

  window.addEventListener("message", (event) => {
    const msg = safeJsonParse_(event.data);
    if (!msg || typeof msg !== "object") return;
    const rid = msg.request_id || msg.requestId;
    if (!rid || !pending.has(rid)) return;
    
    cleanupReq_(rid);
    pending.get(rid).resolve(msg);
  });

  function vfPostIframe(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      ensureBody_(() => {
        const rid = "REQ-" + nowId_();
        const ifr = document.createElement("iframe");
        ifr.name = "vf_ifr_" + rid;
        ifr.style.display = "none";
        document.body.appendChild(ifr);

        const timer = setTimeout(() => {
          if (!pending.has(rid)) return;
          cleanupReq_(rid);
          reject(new Error("TIMEOUT_RESEAU_APPS_SCRIPT"));
        }, timeoutMs);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = VF_SCRIPT_URL;
        form.target = ifr.name;

        const add = (k, v) => {
          const input = document.createElement("input");
          input.type = "hidden"; input.name = k;
          input.value = (v === undefined || v === null) ? "" : String(v);
          form.appendChild(input);
        };

        add("transport", "iframe");
        add("origin", pickClientOriginParam_());
        add("request_id", rid);

        Object.keys(payload || {}).forEach((k) => add(k, payload[k]));
        pending.set(rid, { resolve, reject, timer, iframe: ifr, form });
        document.body.appendChild(form);
        form.submit();
      });
    });
  }

  // --------------------------
  // API Publique
  // --------------------------
  const api = {
    // Actions POST (Iframe par défaut pour éviter CORS)
    post: (data) => vfPostIframe(data),

    register: async (data) => {
      const res = await vfPostIframe({ action: "register", ...data });
      if (AUTO_STORE_AUTH && res.ok && res.token) {
        vfStorage.setToken(res.token);
        vfStorage.setSession(res.user || res.session);
      }
      return res;
    },

    login: async (data) => {
      const res = await vfPostIframe({ action: "login", ...data });
      if (AUTO_STORE_AUTH && res.ok && res.token) {
        vfStorage.setToken(res.token);
        vfStorage.setSession(res.user || res.session);
      }
      return res;
    },

    // Récupération de mot de passe
    forgotPassword: (email, user_ip) => {
      return vfPostIframe({ action: "forgot_password", email, user_ip });
    },
    
    resetPassword: (data) => {
      return vfPostIframe({ action: "reset_password", ...data });
    },

    // Wallet
    walletBalance: (token) => {
      const t = token || vfStorage.getToken();
      return vfPostIframe({ action: "db_wallet_balance", token: t });
    },

    storage: vfStorage
  };

  window.vfApi = api;
})();
