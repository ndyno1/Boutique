/** ===========================
 * VF API CLIENT — V18.8 (HYBRIDE RAPIDE)
 * - GET (Produits) => JSONP (Instantané)
 * - POST (Login/Register) => Iframe (Sécurisé)
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

  // --- MÉTHODE 1 : JSONP (Pour récupérer les produits sans bloquer) ---
  function vfJsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.floor(Math.random() * 1e6);
      window[cb] = (data) => {
        resolve(data);
        delete window[cb];
        document.head.removeChild(script);
      };
      const qs = new URLSearchParams({ action, callback: cb, ...params }).toString();
      const script = document.createElement("script");
      script.src = VF_SCRIPT_URL + (VF_SCRIPT_URL.includes("?") ? "&" : "?") + qs;
      script.onerror = () => reject(new Error("Erreur chargement produits"));
      document.head.appendChild(script);
    });
  }

  // --- MÉTHODE 2 : IFRAME (Pour Login / Register / Wallet) ---
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

  function vfPost(payload = {}) {
    return new Promise((resolve, reject) => {
      const rid = "REQ-" + Date.now();
      const ifr = document.createElement("iframe");
      ifr.style.display = "none";
      ifr.name = "ifr_" + rid;
      document.body.appendChild(ifr);
      const timer = setTimeout(() => {
        if (pending.has(rid)) { reject(new Error("DÉLAI DÉPASSÉ")); pending.delete(rid); }
      }, 30000);
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
      setTimeout(() => { if(form.parentNode) form.parentNode.removeChild(form); }, 1000);
    });
  }

  // --- INTERFACE PUBLIQUE (Compatible avec index.html) ---
  window.vfApi = {
    // Les produits utilisent JSONP (Très rapide, pas d'erreur réseau)
    getProducts: (params) => vfJsonp("get_products", params),
    
    // Le login utilise Iframe (Sécurisé)
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

})();
