// scripts/generate-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, ".."); // repo root

// ====== CONFIG (tu peux aussi overrider via env) ======
const SCRIPT_URL =
  process.env.VF_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

const BASE_URL = (process.env.VF_BASE_URL || "https://viralflowr.com").replace(/\/+$/, "");
const OUT_P = path.join(ROOT, "p");
const OUT_SHARE = path.join(ROOT, "share");

// Debug: si tu veux vérifier un ID précis dans les logs
const CHECK_ID = process.env.VF_CHECK_ID || "1767";

// ====== HELPERS ======
function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}

function escHtml(str) {
  return safe(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function oneLine(s) {
  return safe(s).replace(/\s+/g, " ").trim();
}

function cut(s, n) {
  const t = oneLine(s);
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trim() + "…";
}

function normalizeImg(u) {
  const s = safe(u).trim();
  if (!s) return "";
  // Drive file link -> lh3.googleusercontent
  const m1 = s.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}=w1200`;
  const m2 = s.match(/(?:\?|&)id=([^&]+)/i);
  if (/drive\.google\.com/i.test(s) && m2) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;
  return s;
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.products)) return payload.data.products;
  if (payload && payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  return [];
}

// ID robuste (ton bug “rien généré” arrive souvent ici)
function getId(p) {
  const candidates = [
    p?.id, p?.ID, p?.Id, p?.productId, p?.product_id, p?.productID,
    p?.id_produit, p?.ID_PRODUIT, p?.["ID Produit"], p?.["ID_PRODUIT"],
    p?.ref, p?.REF
  ];
  const v = candidates.find(x => safe(x).trim() !== "");
  return safe(v).trim();
}

function pickName(p) {
  return safe(p?.nom ?? p?.name ?? p?.title).trim();
}

function pickCat(p) {
  return safe(p?.cat ?? p?.category ?? p?.categorie).trim();
}

// Public price (page statique) : client par défaut
function pickPrice(p) {
  const v = (
    p?.prix_client ??
    p?.prix ??
    p?.price ??
    p?.amount ??
    p?.PV ?? p?.pv ??
    p?.prix_affiche ?? // au cas où
    p?.prix_revendeur  // fallback
  );
  return safe(v).trim();
}

function pickDesc(p) {
  return safe(p?.desc ?? p?.description ?? p?.details ?? "").trim();
}

function pickMin(p) {
  const v = p?.min ?? p?.minqnt ?? p?.minQty ?? p?.min_qty;
  return safe(v).trim();
}

function pickMax(p) {
  const v = p?.max ?? p?.maxqnt ?? p?.maxQty ?? p?.max_qty;
  return safe(v).trim();
}

function buildPayUrl(prod, price) {
  const qp = new URLSearchParams();
  qp.set("nom", safe(prod.nom));
  qp.set("prix", safe(price));
  qp.set("cat", safe(prod.cat));
  qp.set("id", safe(prod.id));
  qp.set("min", safe(prod.min));
  qp.set("max", safe(prod.max));
  qp.set("img", safe(prod.img));
  qp.set("desc", safe(prod.desc));
  return `/paiement.html?${qp.toString()}`;
}

async function fetchProducts() {
  // 1) essai JSON direct
  const urls = [
    `${SCRIPT_URL}?action=get_products&format=json&t=${Date.now()}`,
    `${SCRIPT_URL}?action=get_products&t=${Date.now()}`
  ];

  let lastText = "";
  for (const url of urls) {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    lastText = text;

    // tente JSON
    try {
      const json = JSON.parse(text);
      return extractList(json);
    } catch (_) {}

    // tente JSONP: callback( ... );
    const m = text.match(/^[\w$]+\(([\s\S]*)\)\s*;?\s*$/);
    if (m) {
      try {
        const json = JSON.parse(m[1]);
        return extractList(json);
      } catch (_) {}
    }
  }

  throw new Error("Impossible de parser la réponse produits (JSON/JSONP). Extrait: " + lastText.slice(0, 140));
}

// ====== TEMPLATES ======
function productPageHtml(p) {
  const fallbackImg = "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  const id = safe(p.id);
  const name = safe(p.nom);
  const cat = safe(p.cat);
  const price = safe(p.price);
  const img = normalizeImg(p.img) || fallbackImg;
  const desc = safe(p.desc);

  const canonical = `${BASE_URL}/p/${encodeURIComponent(id)}/`;
  const metaDesc = cut(`${price} $ • ${cat} • ${desc}`, 160);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: [img],
    description: desc,
    brand: { "@type": "Brand", name: "ViralFlowr" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price,
      availability: "https://schema.org/InStock",
      url: canonical,
    },
  };

  const payUrl = buildPayUrl({ ...p, img }, price);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>${escHtml(name)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(metaDesc)}">
  <link rel="canonical" href="${escHtml(canonical)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(name)}">
  <meta property="og:description" content="${escHtml(metaDesc)}">
  <meta property="og:image" content="${escHtml(img)}">
  <meta property="og:url" content="${escHtml(canonical)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(img)}">

  <script type="application/ld+json">${escHtml(JSON.stringify(ld))}</script>

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    html, body { width:100%; max-width:100%; overflow-x:hidden; }
    body { font-family: Inter, sans-serif; background:#F3F3F3; color:#201B16; padding-bottom: env(safe-area-inset-bottom); }
    .btn-gradient { background: linear-gradient(90deg, #F07E13 0%, #FFB26B 100%); }
    .shadow-card { box-shadow: 0 0 7px 0 rgba(0,0,0,.15); }
  </style>
</head>

<body class="flex flex-col min-h-screen">
  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-200 shadow-sm">
    <div class="max-w-[1240px] mx-auto h-16 px-4 flex items-center justify-between">
      <a class="text-2xl font-black tracking-tighter" href="/index.html">Viral<span style="color:#F07E13">Flowr</span></a>
      <div class="flex gap-2">
        <a class="px-4 h-10 rounded-full border border-gray-200 bg-white font-black text-[11px] uppercase tracking-wider flex items-center" href="/index.html">Boutique</a>
        <a class="px-4 h-10 rounded-full border border-green-200 bg-green-500 text-white font-black text-[11px] uppercase tracking-wider flex items-center"
           href="https://wa.me/243850373991" target="_blank" rel="noopener noreferrer">Support</a>
      </div>
    </div>
  </header>

  <main class="flex-1 mt-6 mb-16">
    <div class="max-w-[1240px] mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <section class="bg-white border border-gray-100 shadow-card rounded-xl p-6 md:p-8">
        <h1 class="font-black text-2xl md:text-3xl mb-6">${escHtml(name)}</h1>
        <div class="flex flex-col sm:flex-row gap-6">
          <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
            <img src="${escHtml(img)}" class="w-full h-full object-contain" alt="${escHtml(name)}"
                 onerror="this.src='${fallbackImg}'">
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">${escHtml(cat)}</div>
            <div class="text-sm font-medium whitespace-pre-line break-words text-gray-700">${escHtml(desc)}</div>
          </div>
        </div>
      </section>

      <aside class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-5">
        <div class="flex items-end justify-between">
          <div>
            <div class="text-xs font-bold text-gray-400">Prix</div>
            <div class="text-3xl font-black tracking-tighter">${escHtml(price)} $</div>
          </div>
          <div class="text-right text-[11px] text-gray-400 font-bold">
            <div>Min: <span class="text-gray-700">${escHtml(p.min || "-")}</span></div>
            <div>Max: <span class="text-gray-700">${escHtml(p.max || "∞")}</span></div>
          </div>
        </div>

        <a href="${escHtml(payUrl)}"
           class="w-full h-12 rounded-full btn-gradient text-white font-black uppercase tracking-wide shadow-lg hover:scale-[1.02] transition flex items-center justify-center">
          Acheter maintenant
        </a>

        <a href="/share/${encodeURIComponent(id)}/"
           class="text-center text-xs font-black text-gray-400 hover:text-orange-500 transition">
          Partager ce produit
        </a>

        <a href="/index.html" class="text-center text-[12px] font-black uppercase text-gray-500 hover:text-orange-600 transition">
          Retour Boutique
        </a>
      </aside>
    </div>
  </main>

  <footer class="bg-white border-t border-gray-200">
    <div class="max-w-[1240px] mx-auto px-4 py-10 text-[10px] text-gray-400 font-black uppercase tracking-widest">
      © 2026 ViralFlowr • Paiement sécurisé • Livraison digitale
    </div>
  </footer>
</body>
</html>`;
}

function sharePageHtml(id) {
  const url = `${BASE_URL}/p/${encodeURIComponent(id)}/`;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Partager | ViralFlowr</title>
  <meta http-equiv="refresh" content="0;url=${escHtml(url)}">
</head>
<body>
  <script>
    (function(){
      var u = ${JSON.stringify(url)};
      try{
        if (navigator.share) {
          navigator.share({ title: "ViralFlowr", url: u }).finally(function(){ location.href = u; });
          return;
        }
      }catch(e){}
      location.href = u;
    })();
  </script>
</body>
</html>`;
}

// ====== MAIN ======
async function main() {
  console.log("[gen] root:", ROOT);
  console.log("[gen] out:", OUT_P, OUT_SHARE);

  fs.mkdirSync(OUT_P, { recursive: true });
  fs.mkdirSync(OUT_SHARE, { recursive: true });

  const products = await fetchProducts();
  console.log("[gen] products fetched:", products.length);

  let hitCheck = false;
  let written = 0;

  for (const raw of products) {
    const id = getId(raw);
    if (!id) continue;

    const name = pickName(raw);
    const cat = pickCat(raw);
    const price = pickPrice(raw);
    const desc = pickDesc(raw);
    const img = safe(raw?.img ?? raw?.image ?? raw?.photo);
    const min = pickMin(raw);
    const max = pickMax(raw);

    const data = { id, nom: name, cat, price, desc, img, min, max };

    // p/<id>/index.html
    const dirP = path.join(OUT_P, id);
    fs.mkdirSync(dirP, { recursive: true });
    fs.writeFileSync(path.join(dirP, "index.html"), productPageHtml(data), "utf8");

    // share/<id>/index.html
    const dirS = path.join(OUT_SHARE, id);
    fs.mkdirSync(dirS, { recursive: true });
    fs.writeFileSync(path.join(dirS, "index.html"), sharePageHtml(id), "utf8");

    written++;
    if (safe(CHECK_ID) === id) hitCheck = true;
  }

  console.log("[gen] pages written:", written);
  console.log(`[gen] check id ${CHECK_ID}:`, hitCheck ? "OK (generated)" : "NOT FOUND in API list");

  // petit fichier utile si jamais tu veux éviter des comportements jekyll
  // fs.writeFileSync(path.join(ROOT, ".nojekyll"), "", "utf8");
}

main().catch((err) => {
  console.error("[gen] ERROR:", err);
  process.exit(1);
});
