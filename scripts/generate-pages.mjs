// scripts/generate-pages.mjs
// ✅ Génère les pages produits dans /p/<id>/index.html (dans le dossier de build)
// ✅ Corrige les erreurs "Unexpected token '<'" et "Unexpected identifier 'href'" (plus d’HTML brut hors string)
// ✅ Copie tes fichiers statiques (public -> dist) puis ajoute /p/
// Node 18+ / 20+ (fetch natif)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ---- CONFIG (change si besoin) ----
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(ROOT, process.env.OUT_DIR)
  : path.resolve(ROOT, "dist"); // dossier déployé par GitHub Pages artifact

const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(ROOT, process.env.PUBLIC_DIR)
  : path.resolve(ROOT, "public"); // si tu as un dossier public/

const SCRIPT_URL = process.env.VF_SCRIPT_URL
  ? String(process.env.VF_SCRIPT_URL)
  : "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const FALLBACK_IMG = "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

// ---- Helpers FS ----
async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFileEnsured(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function rmDirSafe(p) {
  if (!(await exists(p))) return;
  await fs.rm(p, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyDir(s, d);
    } else if (ent.isFile()) {
      await ensureDir(path.dirname(d));
      await fs.copyFile(s, d);
    }
  }
}

// ---- Helpers data ----
function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}
function up(v) {
  return safe(v).trim().toUpperCase();
}
function encPathSegment(v) {
  // IMPORTANT: doit matcher ton index.html qui fait encodeURIComponent(id)
  return encodeURIComponent(safe(v).trim());
}

// ---- Fetch products (JSON ou JSONP) ----
function tryParseJsonp(text) {
  // Ex: callback({...}) ; ou cb123([...])
  const m = text.match(/^[a-zA-Z0-9_$]+\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) return null;
  const inside = m[1];
  try {
    return JSON.parse(inside);
  } catch {
    return null;
  }
}

async function fetchProducts() {
  const urlJson = `${SCRIPT_URL}?action=get_products&t=${Date.now()}`;
  const urlJsonp = `${SCRIPT_URL}?action=get_products&callback=vf_cb&t=${Date.now()}`;

  // 1) tente JSON
  try {
    const r = await fetch(urlJson, { method: "GET" });
    const txt = await r.text();
    try {
      const j = JSON.parse(txt);
      return normalizeProductsPayload(j);
    } catch {
      const jp = tryParseJsonp(txt);
      if (jp) return normalizeProductsPayload(jp);
    }
  } catch {
    // ignore -> fallback
  }

  // 2) tente JSONP
  const r2 = await fetch(urlJsonp, { method: "GET" });
  const txt2 = await r2.text();
  const jp2 = tryParseJsonp(txt2);
  if (!jp2) throw new Error("API get_products: réponse non-JSON/non-JSONP");
  return normalizeProductsPayload(jp2);
}

function normalizeProductsPayload(payload) {
  if (payload && payload.error) throw new Error(String(payload.error));
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// ---- HTML template product ----
function productPageHtml({ encodedId }) {
  // Page “stub” : elle charge le produit via API get_products côté client puis filtre par id
  // ✅ marche même si ton Apps Script n'a pas d'endpoint get_product
  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>ViralFlowr | Produit</title>

  <script>
    // Canonical domaine (www -> non-www) sans boucle (optionnel)
    (function () {
      const ref = document.referrer || "";
      const inAppsScriptPanel = /script\\.googleusercontent\\.com|script\\.google\\.com/i.test(ref);
      if (inAppsScriptPanel) return;

      const host = (location.hostname || "").toLowerCase();
      const isWWW = host === "www.viralflowr.com";
      const isApex = host === "viralflowr.com";
      const isTarget = isWWW || isApex;
      if (!isTarget) return;

      const CANON_HOST = "viralflowr.com";
      if (host === CANON_HOST) return;

      const GUARD_KEY = "vf_canon_redirect_guard";
      const now = Date.now();
      try {
        const guard = JSON.parse(sessionStorage.getItem(GUARD_KEY) || "null");
        if (guard && (now - guard.ts) < 15000) return;
        sessionStorage.setItem(GUARD_KEY, JSON.stringify({ ts: now, from: host, to: CANON_HOST }));
      } catch (_) {}
      location.replace("https://" + CANON_HOST + location.pathname + location.search + location.hash);
    })();
  </script>

  <script>
    window.VF_CONFIG = window.VF_CONFIG || {};
    window.VF_CONFIG.scriptUrl = window.VF_CONFIG.scriptUrl || ${JSON.stringify(SCRIPT_URL)};
    window.VF_PRODUCT_ID = ${JSON.stringify(encodedId)};
  </script>

  <script src="/vf_api.js?v=200" defer></script>
  <script src="https://cdn.tailwindcss.com"></script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    body{ font-family:Inter, sans-serif; background:#F8FAFC; color:#111827; }
    .brand-gradient{ background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%); }
    .card{ background:#fff; border:1px solid #eee; border-radius:24px; box-shadow:0 12px 25px rgba(0,0,0,.06); }
    .btn{ height:44px; padding:0 14px; border-radius:14px; font-weight:900; font-size:11px; letter-spacing:.12em; text-transform:uppercase; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
    .btn-outline{ background:#fff; border:1px solid #E5E7EB; color:#111827; }
    .btn-outline:hover{ border-color:#F07E13; color:#F07E13; }
    .btn-primary{ color:#fff; }
    .mono{ font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }
  </style>
</head>

<body>
  <header class="bg-white sticky top-0 z-50 border-b border-gray-100 shadow-sm">
    <div class="max-w-[1100px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
      <a href="/index.html" class="text-2xl font-black tracking-tighter">
        Viral<span style="color:#F07E13">Flowr</span>
      </a>
      <div class="flex items-center gap-2">
        <a href="/index.html" class="btn btn-outline">Boutique</a>
        <a href="/wallet.html" class="btn btn-outline">Wallet</a>
      </div>
    </div>
  </header>

  <main class="max-w-[1100px] mx-auto px-4 py-8">
    <div id="err" class="hidden mb-5 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-2xl px-4 py-3"></div>

    <section class="card p-5 md:p-8">
      <div class="grid md:grid-cols-2 gap-6 items-start">
        <div class="bg-[#F8FAFC] rounded-3xl p-6 flex items-center justify-center">
          <img id="img" src=${JSON.stringify(FALLBACK_IMG)} alt="Produit" class="w-full h-[320px] object-contain" />
        </div>

        <div>
          <div id="cat" class="text-[10px] font-black uppercase tracking-widest text-gray-400">—</div>
          <h1 id="name" class="text-3xl font-black tracking-tighter mt-2">Chargement…</h1>

          <div class="mt-4 flex items-end justify-between gap-4">
            <div>
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">Prix</div>
              <div id="price" class="text-4xl font-black tracking-tighter mt-1">—</div>
              <div id="limits" class="mt-2 text-[11px] font-bold text-gray-400">—</div>
            </div>
            <a id="buy" href="/index.html" class="btn brand-gradient btn-primary">Commander</a>
          </div>

          <div class="mt-6 p-4 rounded-2xl bg-gray-50 border border-gray-200">
            <div class="text-[10px] font-black uppercase tracking-widest text-gray-400">ID produit</div>
            <div id="pid" class="mt-1 mono font-black text-sm text-gray-900">—</div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <a href="/index.html" class="btn btn-outline">Retour</a>
            <a href="/commandes.html" class="btn btn-outline">Mes commandes</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script>
    const SCRIPT_URL =
      (window.VF_CONFIG && window.VF_CONFIG.scriptUrl)
      ? String(window.VF_CONFIG.scriptUrl)
      : ${JSON.stringify(SCRIPT_URL)};

    const PRODUCT_ID_ENC = String(window.VF_PRODUCT_ID || "").trim(); // déjà encodé (encodeURIComponent)
    const PRODUCT_ID = decodeURIComponent(PRODUCT_ID_ENC || "");

    const $ = (id) => document.getElementById(id);
    const errBox = $("err");

    function showErr(msg){
      errBox.textContent = String(msg || "Erreur");
      errBox.classList.remove("hidden");
    }

    function safe(v){ return (v === null || v === undefined) ? "" : String(v); }
    function pName(p){ return safe(p.nom || p.name || p.title); }
    function pCat(p){ return safe(p.cat || p.category || p.categorie); }
    function pImg(p){ return safe(p.img || p.image || p.photo); }
    function pMin(p){ return safe(p.min || p.minqnt || p.minQty || p.min_qty); }
    function pMax(p){ return safe(p.max || p.maxqnt || p.maxQty || p.max_qty); }
    function pPrice(p){
      return safe((p && (
        p.prix_affiche ??
        p.prix_revendeur ??
        p.RESELLER ?? p.reseller ??
        p.prix ?? p.price ?? p.amount ??
        p.PV ?? p.pv ??
        p.prix_client
      )));
    }
    function sanitizeHttpUrl(u){
      const s = safe(u).trim();
      if (!s) return "";
      if (/^https?:\\/\\//i.test(s)) return s;
      return "";
    }

    async function loadAllProducts(){
      const url = SCRIPT_URL + "?action=get_products&t=" + Date.now();
      const r = await fetch(url);
      const txt = await r.text();

      try {
        const j = JSON.parse(txt);
        return Array.isArray(j) ? j : (Array.isArray(j.products) ? j.products : []);
      } catch {
        // JSONP fallback
        const m = txt.match(/^[a-zA-Z0-9_$]+\\(([^]*)\\)\\s*;?\\s*$/);
        if (!m) throw new Error("Réponse API invalide");
        const inside = m[1];
        const j2 = JSON.parse(inside);
        return Array.isArray(j2) ? j2 : (Array.isArray(j2.products) ? j2.products : []);
      }
    }

    (async function(){
      try{
        $("pid").textContent = PRODUCT_ID || PRODUCT_ID_ENC || "—";

        const list = await loadAllProducts();
        const found = list.find(p => String(p.id || "").trim() === PRODUCT_ID);

        if(!found){
          $("name").textContent = "Produit introuvable";
          showErr("Ce produit n'existe pas ou a été retiré.");
          return;
        }

        const name = pName(found) || "Produit";
        const cat  = pCat(found) || "—";
        const img  = sanitizeHttpUrl(pImg(found)) || ${JSON.stringify(FALLBACK_IMG)};
        const priceRaw = pPrice(found);
        let priceTxt = "—";
        if (safe(priceRaw).trim() !== ""){
          const n = parseFloat(String(priceRaw).replace(",", "."));
          priceTxt = Number.isFinite(n) ? n.toFixed(2) + " $" : safe(priceRaw) + " $";
        }

        $("name").textContent = name;
        $("cat").textContent = cat;
        $("img").src = img;
        $("img").onerror = () => { $("img").src = ${JSON.stringify(FALLBACK_IMG)}; };

        $("price").textContent = priceTxt;

        const min = pMin(found);
        const max = pMax(found);
        $("limits").textContent = (min || max) ? ("Min " + (min||"-") + " • Max " + (max||"-")) : "—";

        // Bouton commander: renvoie vers la boutique (tu peux changer vers une page commande si tu en as)
        $("buy").href = "/index.html";
      }catch(e){
        $("name").textContent = "Erreur de chargement";
        showErr(e && e.message ? e.message : "Erreur API");
      }
    })();
  </script>
</body>
</html>`;
}

// ---- Generate product pages ----
async function generateProductPages(products) {
  const pRoot = path.join(OUT_DIR, "p");
  await rmDirSafe(pRoot);              // nettoie ancien /p
  await ensureDir(pRoot);

  let count = 0;
  for (const p of products) {
    const rawId = safe(p?.id).trim();
    if (!rawId) continue;

    const encodedId = encPathSegment(rawId); // IMPORTANT: doit matcher les liens de la boutique
    const file = path.join(pRoot, encodedId, "index.html");
    await writeFileEnsured(file, productPageHtml({ encodedId }));
    count++;
  }
  return count;
}

// ---- Main ----
async function main() {
  console.log("VF build out:", OUT_DIR);

  await ensureDir(OUT_DIR);

  // 1) Copie /public -> /dist (si existe)
  if (await exists(PUBLIC_DIR)) {
    console.log("Copy public -> out:", PUBLIC_DIR, "->", OUT_DIR);
    await copyDir(PUBLIC_DIR, OUT_DIR);
  } else {
    console.log("No public/ found (skip copy).");
  }

  // 2) Récupère produits via Apps Script
  console.log("Fetch products from:", SCRIPT_URL);
  const products = await fetchProducts();
  console.log("Products:", products.length);

  // 3) Génère /p/<id>/index.html
  const n = await generateProductPages(products);
  console.log("Generated product pages:", n);

  // (optionnel) dump json
  await writeFileEnsured(path.join(OUT_DIR, "products.json"), JSON.stringify(products, null, 2));

  console.log("DONE.");
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
