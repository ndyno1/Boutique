// --------------------------
  // Communication (Iframe / postMessage) — VERSION FORCE VIRALFLOWR
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

  // Écouteur de message simplifié au maximum
  window.addEventListener("message", (event) => {
    // On accepte le message peu importe l'origine pour le test final
    const msg = safeJsonParse_(event.data);
    if (!msg) return;

    // On cherche l'ID de la requête (indispensable)
    const rid = msg.request_id || msg.requestId;
    
    if (rid && pending.has(rid)) {
      if (CFG.debug) console.log("Signal reçu pour:", rid);
      const p = pending.get(rid);
      cleanupReq_(rid);
      p.resolve(msg);
    }
  });

  function vfPostIframe(payload = {}, timeoutMs = DEFAULT_TIMEOUT){
    return new Promise((resolve, reject) => {
      ensureBody_(() => {
        const rid = "REQ-" + nowId_();
        
        // Création de l'iframe de retour
        const ifr = document.createElement("iframe");
        ifr.name = "vf_ifr_" + rid;
        ifr.id = "vf_ifr_" + rid;
        ifr.style.display = "none";
        document.body.appendChild(ifr);

        const timer = setTimeout(() => {
          if (pending.has(rid)) {
            cleanupReq_(rid);
            reject(new Error("TIMEOUT_RESEAU_APPS_SCRIPT"));
          }
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

        // Paramètres critiques pour Google Apps Script
        add("transport", "iframe");
        add("origin", location.origin); // Envoie l'origine réelle de ton site
        add("request_id", rid);

        Object.keys(payload || {}).forEach((k) => add(k, payload[k]));
        
        pending.set(rid, { resolve, reject, timer, iframe: ifr, form: form });
        
        document.body.appendChild(form);
        form.submit();
      });
    });
  }
