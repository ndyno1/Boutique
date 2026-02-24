/** ===========================
 * VF API CLIENT — V18.9 (FORCE PRODUITS)
 * - Supporte le format JSONP et le format Iframe
 * - Compatible ViralFlowr Index
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  const VF_SCRIPT_URL = String(CFG.scriptUrl || "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec").trim();

  const vfStorage = {
    getToken(){ return localStorage.getItem("vf_token") || ""; },
    setToken(t){ t ? localStorage.setItem("vf_token", t) : localStorage.removeItem("vf_token"); },
    getSession(){ try { return JSON.parse(localStorage.getItem("vf_session") || "null"); } catch(_){ return null; } },
    setSession(s){ s ? localStorage.setItem("vf_session", JSON.stringify(s)) : localStorage.removeItem("vf_session"); },
    clear(){ localStorage.clear(); }
  };

  const pending = new Map();

  // --- ÉCOUTEUR DE RETOUR (Pour Login et Wallet) ---
  window.addEventListener("message", (e) => {
    let m = e.data;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch(err) { return; } }
    const rid = m?.request_id || m?.requestId;
    if (rid && pending.has(rid)) {
      const p = pending.get(rid);
      clearTimeout(p.timer);
      p.resolve(m);
      pending.delete(rid);
      if (p.ifr.parentNode) p.ifr.parentNode.removeChild(p.ifr);
    }
  });

  // --- MÉTHODE POST (Iframe) ---
  function vfPost(payload = {}) {
    return new Promise((resolve, reject) => {
      const rid = "REQ-" + Date.now();
      const ifr = document.createElement("iframe");
      ifr.style.display = "none";
      ifr.name = "ifr_" + rid;
      document.body.appendChild(ifr);
      const timer = setTimeout(() => {
        if (pending.has(rid)) { reject(new Error("DÉLAI DÉPASSÉ")); pending.delete(rid); }
      }, 35000);
      const form = document.createElement("form");
      form.method = "POST"; form.action = VF_SCRIPT_URL; form.target = ifr.name;
      const add = (k, v) => {
        const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v;
        form.appendChild(i);
      };
      add("transport", "iframe"); add("request_id", rid); add("origin", location.origin);
      Object.keys(payload).forEach(k => add(k, payload[k]));
      pending.set(rid, { resolve, timer, ifr });
      document.body.appendChild(form);
      form.submit();
    });
  }

  // --- MÉTHODE GET (JSONP - Pour les Produits) ---
  function vfJsonp(action, params = {}) {
    return new Promise((resolve) => {
      const cb = "cb_" + Math.floor(Math.random() * 1e6);
      window[cb] = (data) => {
        resolve(data);
        try { delete window[cb]; } catch(e){}
      };
      const script = document.createElement("script");
      const qs = new URLSearchParams({ action, callback: cb, ...params }).toString();
      script.src = VF_SCRIPT_URL + (VF_SCRIPT_URL.includes("?") ? "&" : "?") + qs;
      script.onerror = () => resolve({ ok: false, error: "SCRIPT_LOAD_ERR" });
      document.head.appendChild(script);
    });
  }

  // --- INTERFACE UNIVERSELLE ---
  window.vfApi = {
    // Force la récupération des produits
    getProducts: async (params) => {
      // On tente d'abord en JSONP (doGet) car c'est le plus probable pour les produits
      let res = await vfJsonp("get_products", params);
      // Si ça échoue ou renvoie vide, on tente en POST (doPost)
      if (!res || (Array.isArray(res) && res.length === 0)) {
        res = await vfPost({ action: "get_products", ...params });
      }
      return res;
    },

    login: async (data) => {
      const res = await vfPost({ action: "login", ...data });
      if (res.ok && res.token) { 
        vfStorage.setToken(res.token); 
        vfStorage.setSession(res.session || res.user); 
      }
      return res;
    },

    walletBalance: (params) => vfPost({ action: "db_wallet_balance", ...params }),
    storage: vfStorage,
    post: (data) => vfPost(data)
  };

  window.vfStorage = vfStorage;
})();
