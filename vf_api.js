/** ===========================
 * VF API CLIENT — V19.0 (PATCH PRODUITS)
 * - Supporte Iframe POST pour login / wallet / actions sécurisées
 * - Supporte JSONP pour compatibilité catalogue
 * - Fallback JSON direct sur api_services pour les produits
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  const VF_SCRIPT_URL = String(
    CFG.scriptUrl ||
    "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec"
  ).trim();

  const vfStorage = {
    // Rôle : récupérer le token courant
    getToken(){ return localStorage.getItem("vf_token") || ""; },

    // Rôle : sauvegarder ou supprimer le token
    setToken(t){ t ? localStorage.setItem("vf_token", t) : localStorage.removeItem("vf_token"); },

    // Rôle : récupérer la session utilisateur
    getSession(){
      try { return JSON.parse(localStorage.getItem("vf_session") || "null"); }
      catch(_){ return null; }
    },

    // Rôle : sauvegarder ou supprimer la session utilisateur
    setSession(s){
      s ? localStorage.setItem("vf_session", JSON.stringify(s)) : localStorage.removeItem("vf_session");
    },

    // Rôle : vider le stockage local ViralFlowr
    clear(){ localStorage.clear(); }
  };

  const pending = new Map();

  // Rôle : recevoir les réponses iframe pour les requêtes POST
  window.addEventListener("message", (e) => {
    let m = e.data;
    if (typeof m === "string") {
      try { m = JSON.parse(m); } catch(err) { return; }
    }
    const rid = m?.request_id || m?.requestId;
    if (rid && pending.has(rid)) {
      const p = pending.get(rid);
      clearTimeout(p.timer);
      p.resolve(m);
      pending.delete(rid);
      if (p.ifr && p.ifr.parentNode) p.ifr.parentNode.removeChild(p.ifr);
    }
  });

  // Rôle : effectuer une requête POST via iframe
  function vfPost(payload = {}) {
    return new Promise((resolve, reject) => {
      const rid = "REQ-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
      const ifr = document.createElement("iframe");
      ifr.style.display = "none";
      ifr.name = "ifr_" + rid;
      document.body.appendChild(ifr);

      const timer = setTimeout(() => {
        if (pending.has(rid)) {
          pending.delete(rid);
          try { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); } catch(_){}
          reject(new Error("DÉLAI DÉPASSÉ"));
        }
      }, 35000);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = VF_SCRIPT_URL;
      form.target = ifr.name;

      const add = (k, v) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = v == null ? "" : String(v);
        form.appendChild(i);
      };

      add("transport", "iframe");
      add("request_id", rid);
      add("origin", location.origin);

      Object.keys(payload || {}).forEach(k => add(k, payload[k]));

      pending.set(rid, { resolve, timer, ifr });
      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try { if (form.parentNode) form.parentNode.removeChild(form); } catch(_){}
      }, 1000);
    });
  }

  // Rôle : effectuer une requête GET via JSONP
  function vfJsonp(action, params = {}) {
    return new Promise((resolve) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);

      window[cb] = (data) => {
        resolve(data);
        try { delete window[cb]; } catch(_){}
      };

      const script = document.createElement("script");
      const qs = new URLSearchParams({
        action,
        callback: cb,
        ...params
      }).toString();

      script.src = VF_SCRIPT_URL + (VF_SCRIPT_URL.includes("?") ? "&" : "?") + qs;

      script.onerror = () => {
        resolve({ ok: false, error: "SCRIPT_LOAD_ERR" });
        try { delete window[cb]; } catch(_){}
        try { if (script.parentNode) script.parentNode.removeChild(script); } catch(_){}
      };

      document.head.appendChild(script);

      setTimeout(() => {
        try { if (script.parentNode) script.parentNode.removeChild(script); } catch(_){}
      }, 15000);
    });
  }

  // Rôle : effectuer une requête GET JSON directe
  async function vfGetJson(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const url = VF_SCRIPT_URL + (VF_SCRIPT_URL.includes("?") ? "&" : "?") + qs;

    const resp = await fetch(url, {
      method: "GET",
      credentials: "omit"
    });

    return resp.json();
  }

  // Rôle : normaliser les réponses catalogue en tableau produits
  function normalizeProductsPayload_(res) {
    if (Array.isArray(res)) return { ok: true, products: res };
    if (res && Array.isArray(res.products)) return { ok: true, products: res.products };
    if (res && Array.isArray(res.services)) return { ok: true, products: res.services };
    return { ok: false, products: [] };
  }

  // Rôle : vérifier si une réponse produits est exploitable
  function hasUsableProducts_(res) {
    const norm = normalizeProductsPayload_(res);
    return Array.isArray(norm.products) && norm.products.length > 0;
  }

  // Rôle : client API universel ViralFlowr
  window.vfApi = {
    // Rôle : charger les produits avec fallback robuste
    getProducts: async (params = {}) => {
      console.log("VF_API getProducts params =", params);
      console.log("VF_API scriptUrl =", VF_SCRIPT_URL);

      // 1) Tentative JSONP historique
      let res = await vfJsonp("get_products", params);
      console.log("VF_API getProducts JSONP =", res);

      if (hasUsableProducts_(res)) {
        return normalizeProductsPayload_(res);
      }

      // 2) Si erreur JSONP ou vide, fallback JSON propre sur api_services
      const hasJsonpError = !res || (res && res.ok === false) || !hasUsableProducts_(res);

      if (hasJsonpError) {
        try {
          const jsonRes = await vfGetJson("api_services", params);
          console.log("VF_API getProducts api_services =", jsonRes);

          if (hasUsableProducts_(jsonRes)) {
            return normalizeProductsPayload_(jsonRes);
          }

          return {
            ok: false,
            error: (jsonRes && (jsonRes.error || jsonRes.message)) || "NO_PRODUCTS",
            products: []
          };
        } catch (e) {
          console.error("VF_API getProducts api_services ERROR =", e);
          return {
            ok: false,
            error: "API_SERVICES_FETCH_ERR",
            details: e.message || String(e),
            products: []
          };
        }
      }

      return {
        ok: false,
        error: "NO_PRODUCTS",
        products: []
      };
    },

    // Rôle : effectuer le login utilisateur
    login: async (data) => {
      const res = await vfPost({ action: "login", ...data });
      if (res.ok && res.token) {
        vfStorage.setToken(res.token);
        vfStorage.setSession(res.session || res.user || {
          email: res.email || data?.email || "",
          username: res.username || ""
        });
      }
      return res;
    },

    // Rôle : lire le solde wallet
    walletBalance: (params) => vfPost({ action: "db_wallet_balance", ...params }),

    // Rôle : exposer le stockage
    storage: vfStorage,

    // Rôle : exposer le POST générique
    post: (data) => vfPost(data)
  };

  window.vfStorage = vfStorage;
})();
