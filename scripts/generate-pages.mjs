// scripts/generate-pages.mjs
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();

const SITE_BASE = (process.env.SITE_BASE || "https://viralflowr.com").replace(/\/+$/, "");
const VF_SCRIPT_URL =
  process.env.VF_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || "25000", 10);
const EXPECT_ID = (process.env.EXPECT_ID || "").trim();

const OUT_P = path.join(ROOT, "p");
const OUT_SHARE = path.join(ROOT, "share");

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}
function cleanId(v) {
  return safeStr(v).trim();
}
function escapeHtml(s) {
  return safeStr(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// Fonction pour rendre les liens cliquables dans la description
function linkify(text) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlPattern, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline hover:text-orange-700 break-all">${url}</a>`;
  });
}

function escapeAttr(s) {
  return escapeHtml(s);
}
function truncateText(s, n = 160) {
  const t = safeStr(s).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trim() + "…";
}
function formatPrice(v) {
  const s = safeStr(v).trim().replace(",", ".");
  const num = Number(s);
  if (!Number.isFinite(num)) return safeStr(v).trim() || "0";
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
  return num.toFixed(2);
}
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
      const v = obj[k];
      if (safeStr(v).trim() !== "") return v;
    }
  }
  return "";
}
function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function fetchText(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "follow" });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    return text;
  } finally {
    clearTimeout(t);
  }
}

function parseJsonOrJsonp(text) {
  const t = safeStr(text).trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    return JSON.parse(t);
  }
  const m = t.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\)\s*;?\s*$/);
  if (m) return JSON.parse(m[1].trim());
  return JSON.parse(t);
}

function normalizeProduct(raw) {
  const id = cleanId(pick(raw, ["id", "ID", "product_id", "productId", "pid"]));
  const nom = safeStr(pick(raw, ["nom", "name", "title", "product_name"])).trim();
  const cat = safeStr(pick(raw, ["cat", "category", "categorie"])).trim();
  const img = safeStr(pick(raw, ["img", "image", "image_url", "imageUrl", "thumbnail"])).trim();
  const prixClient = pick(raw, ["prix", "price", "amount", "prix_client", "PV", "pv"]);
  const min = safeStr(pick(raw, ["min", "minimum"])).trim();
  const max = safeStr(pick(raw, ["max", "maximum"])).trim();
  const desc = safeStr(pick(raw, ["desc", "description", "short_desc"])).trim();
  const long_desc = safeStr(pick(raw, ["long_desc", "longDesc", "long_description", "desc_long"])).trim();

  return { id, nom: nom || `Produit ${id}`, cat, img, priceTxt: formatPrice(prixClient), min, max, desc, long_desc };
}

function buildPayUrl(prod) {
  const qp = new URLSearchParams();
  qp.set("nom", prod.nom);
  qp.set("prix", prod.priceTxt);
  qp.set("cat", prod.cat);
  qp.set("id", prod.id);
  qp.set("min", prod.min);
  qp.set("max", prod.max);
  qp.set("img", prod.img);
  qp.set("desc", prod.desc);
  return "/paiement.html?" + qp.toString();
}

function renderProductPage(prod) {
  const id = prod.id;
  const canonical = `${SITE_BASE}/p/${encodeURIComponent(id)}/`;
  const ogImg = prod.img || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const seoDesc = truncateText(prod.long_desc, 140);
  const payHref = buildPayUrl(prod);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escapeHtml(prod.nom)} | ViralFlowr</title>
  <meta name="description" content="${escapeAttr(seoDesc)}">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root{ --vf-orange:#F07E13; --vf-orange2:#FFB26B; --vf-bg:#F3F3F3; --vf-text:#201B16; }
    body{ font-family:'Inter', sans-serif; background: var(--vf-bg); color:var(--vf-text); }
    .text-orange-bsv { color: var(--vf-orange); }
    .btn-gradient { background: linear-gradient(90deg, var(--vf-orange) 0%, var(--vf-orange2) 100%); }
    .btn-mini{ height:40px; padding:0 14px; border-radius:999px; font-weight:900; font-size:11px; text-transform:uppercase; display:inline-flex; align-items:center; border:1px solid #E5E7EB; background:#fff; }
  </style>
</head>
<body class="flex flex-col min-h-screen">
  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-200 shadow-sm">
    <div class="max-w-[1240px] mx-auto h-16 px-4 flex items-center justify-between">
      <a class="flex items-center gap-2" href="/index.html">
        <div class="text-2xl font-black tracking-tighter">Viral<span class="text-orange-bsv">Flowr</span></div>
      </a>
      <a href="/index.html" class="btn-mini">Boutique</a>
    </div>
  </header>
  <main class="flex-1 mt-6 lg:mt-10 mb-20">
    <div class="max-w-[1240px] mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div class="bg-white shadow-sm rounded-xl p-6 md:p-8">
        <h1 class="font-bold text-2xl md:text-3xl mb-6">${escapeHtml(prod.nom)}</h1>
        <div class="flex flex-col sm:flex-row gap-6">
          <img src="${escapeAttr(ogImg)}" class="w-32 h-32 object-contain rounded-xl border p-2">
          <div class="text-sm leading-relaxed whitespace-pre-line break-words">
            ${linkify(escapeHtml(prod.long_desc))}
          </div>
        </div>
      </div>
      <aside class="bg-white shadow-sm rounded-xl p-6 flex flex-col gap-6 h-fit">
        <div class="text-3xl font-black">${escapeHtml(prod.priceTxt)} $</div>
        <a id="buyBtn" href="${escapeAttr(payHref)}" class="w-full h-12 rounded-full btn-gradient text-white font-bold flex items-center justify-center uppercase">Acheter maintenant</a>
      </aside>
    </div>
  </main>
  <script>
    // ✅ Correction du bug de redirection produit
    (function(){
      const currentId = ${JSON.stringify(id)};
      const lastId = sessionStorage.getItem("vf_last_pid");
      if(lastId && lastId !== currentId){
        // Si l'ID a changé, on nettoie les anciens caches pour forcer la mise à jour
        sessionStorage.removeItem("vf_p_cache_" + lastId);
      }
      sessionStorage.setItem("vf_last_pid", currentId);
    })();

    function getSession_(){
      try { return JSON.parse(localStorage.getItem("vf_session")); } catch(e){ return null; }
    }
    function renderAccountUI_(){
      const s = getSession_();
      if(s) console.log("Utilisateur connecté:", s.username || s.email);
    }
    renderAccountUI_();
  </script>
</body>
</html>`;
}

function renderSharePage(prod) {
  const target = `/p/${encodeURIComponent(prod.id)}/`;
  return `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${target}"><script>location.replace("${target}");</script></head></html>`;
}

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

async function main() {
  const txt = await fetchText(`${VF_SCRIPT_URL}?action=get_products&t=${Date.now()}`);
  const rawList = extractList(parseJsonOrJsonp(txt));
  
  await ensureDir(OUT_P);
  await ensureDir(OUT_SHARE);

  for (const raw of rawList) {
    const prod = normalizeProduct(raw);
    if (!prod.id) continue;
    await writeFile(path.join(OUT_P, prod.id, "index.html"), renderProductPage(prod));
    await writeFile(path.join(OUT_SHARE, prod.id, "index.html"), renderSharePage(prod));
  }
  console.log("Pages générées avec succès.");
}

main().catch((e) => { console.error(e); process.exit(1); });
