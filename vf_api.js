/** ===========================
 * VF API CLIENT — V18.6 (ULTRA-COMPATIBLE)
 * - Décodage JSON automatique pour Apps Script
 * - Mode Iframe Forcé (Zéro Erreur Réseau)
 * - Support IP pré-chargée
 * =========================== */

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  const CFG = (window.VF_CONFIG && typeof window.VF_CONFIG === "object") ? window.VF_CONFIG : {};
  const VF_SCRIPT_URL = String(CFG.scriptUrl || "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec").trim();
  const DEFAULT_TIMEOUT = Number(CFG.timeoutMs || 40000); // 40s pour éviter les délais dépassés

  const vfStorage = {
    getToken(){ return localStorage.getItem("vf_token") || ""; },
    setToken(t){ t ? localStorage.setItem("vf_token", t) : localStorage.removeItem("vf_token"); },
    getSession(){ try { return JSON.parse(localStorage.getItem("vf_session") || "null"); } catch(_){ return null; } },
    setSession(s){ s ? localStorage.setItem("vf_session", JSON.stringify(s)) : localStorage.removeItem("vf_session"); },
    clear(){ localStorage.clear(); }
  };

  const pending = new Map();

  // ÉCOUTEUR DE SIGNAL (CORRIGÉ)
  window.addEventListener("message", (event) => {
    let msg = event.data;
    // Si Google envoie du texte, on le transforme en objet
    if (typeof msg === "string") {
      try { msg = JSON.parse(msg); } catch (e) { return; }
    }
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

  async function vfPost(payload = {}) {
    return new Promise((resolve, reject) => {
      const rid = "REQ-" + Date.now();
      const ifr = document.createElement("iframe");
      ifr.style.display = "none";
      ifr.name = "ifr_" + rid;
      document.body.appendChild(ifr);

      const timer = setTimeout(() => {
        if (pending.has(rid)) {
          reject(new Error("DÉLAI_DÉPASSÉ_GOOGLE"));
          pending.delete(rid);
          if (ifr.parentNode) ifr.parentNode.removeChild(ifr);
        }
      }, DEFAULT_TIMEOUT);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = VF_SCRIPT_URL;
      form.target = ifr.name;

      const add = (k, v) => {
        const i = document.createElement("input");
        i.type = "hidden"; i.name = k; i.value = v;
        form.appendChild(i);
      };

      add("transport", "iframe");
      add("request_id", rid);
      add("origin", location.origin);
      Object.keys(payload).forEach(k => add(k, payload[k]));

      pending.set(rid, { resolve, reject, timer, ifr });
      document.body.appendChild(form);
      form.submit();
      setTimeout(() => { if(form.parentNode) form.parentNode.removeChild(form); }, 1000);
    });
  }

  window.vfApi = {
    login: async (data) => {
      const res = await vfPost({ action: "login", ...data });
      if (res.ok && res.token) { 
        vfStorage.setToken(res.token); 
        vfStorage.setSession(res.session || res.user); 
      }
      return res;
    },
    register: async (data) => await vfPost({ action: "register", ...data }),
    post: (data) => vfPost(data),
    storage: vfStorage
  };
})();
