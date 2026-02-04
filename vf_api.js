<script>
/** ===========================
 *  VF API CLIENT (NO CORS)
 *  - GET => JSONP
 *  - POST => hidden iframe form + postMessage
 * =========================== */

const VF_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

(function initVfBridge(){
  if (window.__vfBridgeReady) return;
  window.__vfBridgeReady = true;

  // Hidden iframe target
  const iframe = document.createElement("iframe");
  iframe.name = "vf_iframe";
  iframe.id = "vf_iframe";
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  // Pending requests by request_id
  const pending = new Map();

  // Listen responses
  window.addEventListener("message", (event) => {
    const o = String(event.origin || "");
    const okOrigin =
      o === "https://script.google.com" ||
      o.endsWith(".googleusercontent.com");

    if (!okOrigin) return;

    let msg = event.data;
    try { if (typeof msg === "string") msg = JSON.parse(msg); } catch(_) {}

    if (!msg || typeof msg !== "object") return;
    const rid = msg.request_id;
    if (!rid || !pending.has(rid)) return;

    const { resolve } = pending.get(rid);
    pending.delete(rid);
    resolve(msg);
  });

  // Expose helpers
  window.vfJsonp = function(action, params = {}) {
    return new Promise((resolve, reject) => {
      const cb = "__vf_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      window[cb] = (data) => {
        try { resolve(data); } finally {
          delete window[cb];
          script.remove();
        }
      };

      const qs = new URLSearchParams({ action, callback: cb, ...params });
      const script = document.createElement("script");
      script.src = VF_SCRIPT_URL + "?" + qs.toString();
      script.onerror = () => {
        delete window[cb];
        script.remove();
        reject(new Error("JSONP_ERROR"));
      };
      document.head.appendChild(script);
    });
  };

  window.vfPost = function(payload = {}) {
    return new Promise((resolve) => {
      const rid = "REQ-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);

      // register pending
      pending.set(rid, { resolve });

      // build form
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

      // mandatory bridge fields
      add("transport", "iframe");
      add("origin", location.origin);
      add("request_id", rid);

      // payload fields
      Object.keys(payload).forEach((k) => add(k, payload[k]));

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => { try { form.remove(); } catch(_) {} }, 1500);
    });
  };

  // High-level API
  window.vfApi = {
    // GET (JSONP)
    getProducts: ({ cat="all", token="" } = {}) => vfJsonp("get_products", { cat, token }),
    orderHistory: ({ email, limit=80 } = {}) => vfJsonp("order_history", { email, limit }),

    // POST (iframe)
    register: ({ username, email, password }) => vfPost({ action:"register", username, email, password }),
    login: ({ email, password }) => vfPost({ action:"login", email, password }),

    walletBalance: ({ token, currency="USD" }) => vfPost({ action:"db_wallet_balance", token, currency }),
    walletTopupCreate: (data) => vfPost({ action:"db_wallet_topup_create", ...data }),

    walletPay: (data) => vfPost({ action:"wallet_pay", ...data }),
    resellerPay: (data) => vfPost({ action:"reseller_pay", ...data }),

    createOrder: (data) => vfPost({ ...data }), // si tu n’envoies pas "action", ça passe par recevoir()
    chatSupport: ({ chat, orderId, email }) => vfPost({ chat, orderId, email }),
  };
})();
</script>
