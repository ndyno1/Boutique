/** ===========================
 *  VF API CLIENT — ADAPTÉ V18.4 (Apps Script)
 *  - GET  => JSONP (OK sans CORS)
 *  - POST => login/register : iframe + postMessage (OK)
 *        => autres actions : fetch via proxy same-origin (sinon impossible sans CORS)
 *  - + cookie token partagé www/non-www + vfStorage
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
    CFG.apiBase ||
    "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec"
  ).trim();

  const DEFAULT_TIMEOUT = Number(CFG.timeoutMs || 20000);
  const DEBUG = !!CFG.debug;

  // ✅ postMode:
  // - "auto"  : login/register = iframe, le reste = proxy si fourni sinon erreur claire
  // - "proxy" : force proxy pour les POST JSON
  // - "iframe": force iframe (⚠️ ne marche QUE si Apps Script renvoie postMessage pour ces actions)
  const POST_MODE = String(CFG.postMode || "auto").toLowerCase();

  // ✅ proxyUrl (même origin que ton site), ex:
  // CFG.proxyUrl = "/vf_proxy"  (Cloudflare Worker / Netlify function)
  const PROXY_URL = CFG.proxyUrl ? String(CFG.proxyUrl).trim() : "";

  // auto-store token/session sur login/register
  const AUTO_STORE_AUTH = (CFG.autoStoreAuth !== false);

  const nowId_ = () => Date.now() + "-" + Math.floor(Math.random() * 1e6);

  const safeJsonParse_ = (x) => {
    try { return (typeof x === "string") ? JSON.parse(x) : x; }
    catch (_) { return x; }
  };

  // --------------------------
  // Panel / origin
  // --------------------------
  const isAppsScriptPanel_ = () => {
    const h = String(location.hostname || "").toLowerCase();
    return (h === "script.google.com" || h.endsWith(".googleusercontent.com"));
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

  const pickClientOriginParam_ = () => {
    if (isAppsScriptPanel_()) return "*";
    if (CFG.postMessageTargetOrigin) return String(CFG.postMessageTargetOrigin);
    if (isTrustedHostForStrictOrigin_()) return String(location.origin);
    return "*";
  };

  function ensureBody_(fn){
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once:true });
  }

  // --------------------------
  // Storage helpers (cookie partagé www/non-www)
  // --------------------------
  const isViralflowrDomain_ = () => {
    const h = String(location.hostname || "").toLowerCase();
    return h === "viralflowr.com" || h.endsWith(".viralflowr.com");
  };

  const COOKIE_DOMAIN = String(CFG.cookieDomain || ".viralflowr.com");
  const COOKIE_TOKEN_KEY = String(CFG.cookieTokenKey || "vf_token");

  function setCookie_(name, value, days){
    try{
      const maxAge = (typeof days === "number") ? (days * 86400) : (14 * 86400);
      const secure = (location.protocol === "https:") ? "; Secure" : "";
      const domain = isViralflowrDomain_() ? ("; Domain=" + COOKIE_DOMAIN) : "";
      document.cookie =
        encodeURIComponent(name) + "=" + encodeURIComponent(String(value || "")) +
        "; Path=/" + domain + "; Max-Age=" + String(maxAge) + "; SameSite=Lax" + secure;
    }catch(_){}
  }

  function getCookie_(name){
    try{
      const n = encodeURIComponent(name) + "=";
      const parts = String(document.cookie || "").split(";").map(s => s.trim());
      for (const p of parts){
        if (p.startsWith(n)) return decodeURIComponent(p.slice(n.length));
      }
    }catch(_){}
    return "";
  }

  function delCookie_(name){
    try{
      const secure = (location.protocol === "https:") ? "; Secure" : "";
      const domain = isViralflowrDomain_() ? ("; Domain=" + COOKIE_DOMAIN) : "";
      document.cookie =
        encodeURIComponent(name) + "=; Path=/" + domain + "; Max-Age=0; SameSite=Lax" + secure;
    }catch(_){}
  }

  const vfStorage = {
    getToken(){
      const t = localStorage.getItem("vf_token") || getCookie_(COOKIE_TOKEN_KEY) || "";
      // sync douce
      if (t && !localStorage.getItem("vf_token")) localStorage.setItem("vf_token", t);
      return t;
    },
    setToken(t){
      const v = String(t || "");
      if (v) {
        localStorage.setItem("vf_token", v);
        setCookie_(COOKIE_TOKEN_KEY, v, 14);
      } else {
        localStorage.removeItem("vf_token");
        delCookie_(COOKIE_TOKEN_KEY);
      }
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
      delCookie_(COOKIE_TOKEN_KEY);
    }
  };

  window.vfStorage = vfStorage;

  // --------------------------
  // IFRAME postMessage (uniquement login/register dans ton Apps Script)
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

  function settle_(rid, kind, data){
    const p = pending.get(rid);
    if (!p) return;
    cleanupReq_(rid);
    if (kind === "resolve") p.resolve(data);
    else p.reject(data);
  }

  const isAllowedOrigin_ = (origin) => {
    const o = String(origin || "");
    if (o === "null" && (location.protocol === "file:" || location.origin === "null")) return true;
    return (
      o === "https://script.google.com" ||
      o === "https://script.googleusercontent.com" ||
      o.endsWith(".googleusercontent.com")
    );
  };

  window.addEventListener("message", (event) => {
    if (!isAllowedOrigin_(event.origin)) return;

    const msg = safeJsonParse_(event.data);
    if (!msg || typeof msg !== "object") return;

    const rid = msg.request_id || msg.requestId;
    if (!rid) return;

    if (DEBUG) console.log("[vfBridge] message origin=", event.origin, "rid=", rid, "pendingHas=", pending.has(rid));

    if (!pending.has(rid)) {
      window.__vfLastBridgeMsg = msg;
      return;
    }

    settle_(rid, "resolve", msg);
  });

  function vfPostIframe(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      ensureBody_(() => {
        if (!VF_SCRIPT_URL) return reject(new Error("SCRIPT_URL_MISSING"));

        const rid = "REQ-" + nowId_();

        const ifr = document.createElement("iframe");
        ifr.name = "vf_iframe_" + rid;
        ifr.id   = "vf_iframe_" + rid;
        ifr.style.display = "none";
        ifr.src = "about:blank";
        document.body.appendChild(ifr);

        const timer = setTimeout(() => {
          if (!pending.has(rid)) return;
          cleanupReq_(rid);
          reject(new Error("IFRAME_TIMEOUT_NO_POSTMESSAGE"));
        }, timeoutMs);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = VF_SCRIPT_URL;
        form.target = ifr.name;
        form.acceptCharset = "UTF-8";

        const add = (k, v) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = (v === undefined || v === null) ? "" : String(v);
          form.appendChild(input);
        };

        // ton Apps Script utilise ces champs
        add("transport", "iframe");
        add("origin", pickClientOriginParam_());
        add("request_id", rid);

        Object.keys(payload || {}).forEach((k) => add(k, payload[k]));

        pending.set(rid, { resolve, reject, timer, iframe: ifr, form });

        document.body.appendChild(form);

        if (DEBUG) console.log("[vfBridge] POST(iframe) rid=", rid, "payload=", payload);

        try { form.submit(); }
        catch (e) { cleanupReq_(rid); reject(e); return; }

        setTimeout(() => { try { if (form && form.parentNode) form.parentNode.removeChild(form); } catch(_) {} }, 1200);
      });
    });
  }

  // --------------------------
  // JSONP (GET) : pour doGet
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
  // POST JSON via proxy (same-origin)
  // --------------------------
  async function vfPostViaProxy(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    if (!PROXY_URL) {
      throw new Error("PROXY_URL_MISSING_FOR_JSON_POST");
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try{
      // Le proxy doit forward vers VF_SCRIPT_URL (et renvoyer JSON)
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ scriptUrl: VF_SCRIPT_URL, payload }),
        signal: ctrl.signal
      });

      const txt = await res.text();
      let js = null;
      try { js = JSON.parse(txt); } catch(_){}

      if (!res.ok) {
        const err = js && (js.error || js.message) ? (js.error || js.message) : ("HTTP_" + res.status);
        throw new Error("PROXY_HTTP_ERROR:" + err);
      }

      return (js !== null) ? js : { ok:true, raw: txt };
    } finally {
      clearTimeout(t);
    }
  }

  // --------------------------
  // Router POST (ADAPTÉ À TON Apps Script)
  // --------------------------
  function isAuthAction_(payload){
    const a = String((payload && payload.action) || "").trim().toLowerCase();
    return a === "login" || a === "register";
  }

  async function vfPost(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    // login/register => iframe + postMessage (conforme Apps Script)
    if (isAuthAction_(payload)) return vfPostIframe(payload, timeoutMs);

    // autres POST => JSON pur côté Apps Script => il faut proxy (ou patch Apps Script)
    if (POST_MODE === "iframe") {
      // ⚠️ ne marche QUE si tu patches Apps Script pour répondre postMessage aussi ici
      return vfPostIframe(payload, timeoutMs);
    }

    if (POST_MODE === "proxy" || POST_MODE === "auto") {
      return vfPostViaProxy(payload, timeoutMs);
    }

    // fallback
    return vfPostViaProxy(payload, timeoutMs);
  }

  // --------------------------
  // API publique (même interface + orderRecharge)
  // --------------------------
  const api = {
    // doGet JSONP
    getProducts: ({ cat="all", token } = {}) => {
      const t = (token !== undefined) ? String(token || "") : vfStorage.getToken();
      return vfJsonp("get_products", { cat, token: t });
    },
    orderHistory: ({ email, limit=80 } = {}) => vfJsonp("order_history", { email, limit }),
    orderRecharge: ({ email, orderId } = {}) => vfJsonp("order_recharge", { email, orderId }),

    // Auth (iframe)
    register: async ({ username, email, password }) => {
      const res = await vfPost({ action:"register", username, email, password });
      if (AUTO_STORE_AUTH && res && res.ok && res.token) {
        vfStorage.setToken(res.token);
        vfStorage.setSession(res.user || res.session || null);
      }
      return res;
    },

    login: async ({ email, password }) => {
      const res = await vfPost({ action:"login", email, password });
      if (AUTO_STORE_AUTH && res && res.ok && res.token) {
        vfStorage.setToken(res.token);
        vfStorage.setSession(res.user || res.session || null);
      }
      return res;
    },

    // POST JSON (proxy)
    walletBalance: ({ token, currency="USD" } = {}) => {
      const t = (token !== undefined) ? String(token || "") : vfStorage.getToken();
      return vfPost({ action:"db_wallet_balance", token: t, currency });
    },

    walletTopupCreate: (data = {}) => {
      const t = (data.token !== undefined) ? String(data.token || "") : vfStorage.getToken();
      return vfPost({ action:"db_wallet_topup_create", ...data, token: t });
    },

    walletPay: (data = {}) => vfPost({ action:"wallet_pay", ...(data||{}) }),
    resellerPay: (data = {}) => {
      const t = (data.token !== undefined) ? String(data.token || "") : vfStorage.getToken();
      return vfPost({ action:"reseller_pay", ...data, token: t });
    },

    createOrder: (data = {}) => vfPost({ ...(data||{}) }),

    chatSupport: ({ chat, orderId, email } = {}) => vfPost({ chat, orderId, email }),

    storage: vfStorage,

    getScriptUrl: () => VF_SCRIPT_URL
  };

  window.vfJsonp = vfJsonp;
  window.vfPost  = vfPost;
  window.vfApi   = api;

})();
