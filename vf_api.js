/** ===========================
 * VF API CLIENT — VERSION UNIVERSELLE (V18.7)
 * - 100% compatible avec tes anciens appels : api.getProducts, api.login, etc.
 * - Règle les problèmes de blocage et de délai.
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  const VF_SCRIPT_URL = String(CFG.scriptUrl || "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec").trim();
  const DEFAULT_TIMEOUT = 40000;

  // --- STORAGE (Garde les mêmes noms de clés qu'avant) ---
  const vfStorage = {
    getToken(){ return localStorage.getItem("vf_token") || ""; },
    setToken(t){ t ? localStorage.setItem("vf_token", t) : localStorage.removeItem("vf_token"); },
    getSession(){ try { return JSON.parse(localStorage.getItem("vf_session") || "null"); } catch(_){ return null; } },
    setSession(s){ s ? localStorage.setItem("vf_session", JSON.stringify(s)) : localStorage.removeItem("vf_session"); },
    clear(){ localStorage.removeItem("vf_token"); localStorage.removeItem("vf_session"); }
  };

  const pending = new Map();

  // --- ÉCOUTEUR DE SIGNAL (Indispensable pour débloquer la page) ---
  window.addEventListener("message", (event) => {
    let msg = event.data;
    if (typeof msg === "string") { try { msg = JSON.parse(msg); } catch (e) { return; } }
    if (!msg || typeof msg !== "object") return;

    const rid = msg.request_id || msg.requestId;
    if (rid && pending.has(rid)) {
      const p = pending.get(rid);
      clearTimeout(p.timer);
      p.resolve(msg);
      pending.delete(rid);
      if (p.ifr && p.ifr.parentNode) p.ifr.parentNode.removeChild(p.ifr);
    }
  });

  // --- LE MOTEUR POST (Méthode Iframe sécurisée) ---
  function vfPost(payload = {}) {
    return new Promise((resolve, reject) => {
      const rid = "REQ-" + Date.now();
      const ifr = document.createElement("iframe");
      ifr.style.display = "none";
      ifr.name = "ifr_" + rid;
      document.body.appendChild(ifr);

      const timer = setTimeout(() => {
        if (pending.has(rid)) {
          pending.delete(rid);
          if (ifr.parentNode) ifr.parentNode.removeChild(ifr);
          reject(new Error("TIMEOUT_GOOGLE"));
        }
      }, DEFAULT_TIMEOUT);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = VF_SCRIPT_URL;
      form.target = ifr.name;

      const add = (k, v) => {
        const i = document.createElement("input");
        i.type = "hidden"; i.name = k; i.value = (v === null || v === undefined) ? "" : v;
        form.appendChild(i);
      };

      add("transport", "iframe");
      add("request_id", rid);
      add("origin", location.origin);
      Object.keys(payload).forEach(k => add(k, payload[k]));

      pending.set(rid, { resolve, reject, timer, ifr });
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => { if(form.parentNode) form.parentNode.removeChild(form); }, 1500);
    });
  }

  // --- L'INTERFACE (Exactement comme tes anciennes pages le demandent) ---
  const api = {
    // Anciennes méthodes de tes pages
    login: async (data) => {
      const res = await vfPost({ action: "login", ...data });
      if (res.ok && res.token) { 
        vfStorage.setToken(res.token); 
        vfStorage.setSession(res.session || res.user); 
      }
      return res;
    },
    register: async (data) => {
      return await vfPost({ action: "register", ...data });
    },
    // Pour forgot.html et reset
    post: (data) => vfPost(data),
    
    // Pour index.html (Wallet, Produits, etc.)
    getProducts: (params) => vfPost({ action: "get_products", ...params }),
    walletBalance: (params) => vfPost({ action: "db_wallet_balance", ...params }),
    orderHistory: (params) => vfPost({ action: "order_history", ...params }),
    
    // Accès au storage
    storage: vfStorage,
    getScriptUrl: () => VF_SCRIPT_URL
  };

  // On expose tout comme avant
  window.vfApi = api;
  window.vfStorage = vfStorage;
  window.vfPost = vfPost;

})();
