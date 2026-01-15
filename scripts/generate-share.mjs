// scripts/generate-pages.mjs
import fs from "fs";
import path from "path";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec";

// ---------- helpers ----------
const safe = (v) => (v === null || v === undefined) ? "" : String(v);
const escHtml = (s) => safe(s)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function toDirectOGImage(url) {
  const u = safe(url).trim();
  if (!u) return "";

  // 이미 lh3 googleusercontent direct
  if (u.includes("lh3.googleusercontent.com/d/")) {
    // force size
    return u.includes("=") ? u : `${u}=w1200`;
  }

  // drive file view -> convert
  const m1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return `https://lh3.googleusercontent.com/d/${m1[1]}=w1200`;

  // drive open?id=
  const m2 = u.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2 && m2[1]) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;

  // if normal image url (jpg/png/webp) keep
  if (/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(u)) return u;

  return u; // fallback
}

function buildPayUrl(p) {
  // Garde ta logique paiement (params)
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id",  safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("desc", safe(p.desc || p.description));
  qp.set("long", safe(p.long_desc || p.long || p.longDescription));
  return `/paiement.html?${qp.toString()}`;
}

async function fetchProducts() {
  // JSONP -> on extrait le JSON entre (...)
  const cb = "cb";
  const url = `${SCRIPT_URL}?action=get_products&callback=${cb}&t=${Date.now()}`;
  const res = await fetch(url);
  const txt = await res.text();

  const start = txt.indexOf("(");
  const end = txt.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Réponse JSONP invalide. Vérifie action=get_products.");
  }
  const jsonStr = txt.slice(start + 1, end).trim();
  const data = JSON.parse(jsonStr);
  if (!Array.isArray(data)) throw new Error("Le endpoint ne renvoie pas une liste.");
  return data;
}

// ---------- templates ----------
function templateProductPage(p) {
  const id = safe(p.id).trim();
  const nom = safe(p.nom).trim() || `Produit ${id}`;
  const cat = safe(p.cat).trim() || "Service";
  const prix = safe(p.prix).trim() || "0";
  const desc = safe(p.desc || p.description).trim();
  const longDesc = safe(p.long_desc || p.long || p.longDescription).trim();

  const imgRaw = safe(p.img).trim();
  const ogImg = toDirectOGImage(imgRaw) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const payUrl = buildPayUrl(p);

  const ogDesc = `${prix} $ • ${cat}${desc ? " • " + desc.replace(/\s+/g, " ").slice(0, 120) : ""}`.slice(0, 200);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escHtml(nom)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(ogDesc)}">

  <!-- OG preview -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(nom)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImg)}">
  <meta property="og:url" content="https://viralflowr.com/p/${encodeURIComponent(id)}/">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(ogImg)}">

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    body { font-family:'Inter',sans-serif; scroll-behavior:smooth; }
    .brand-gradient { background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%); }
    .hover-card { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); }
    .hover-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border-color:#F07E13; }
    .btn-support { background:#25D366; color:white; padding:8px 16px; border-radius:12px; font-weight:800; font-size:12px; display:flex; align-items:center; gap:8px; transition:.3s; }
    .btn-support:hover { transform:scale(1.05); box-shadow:0 10px 15px -3px rgba(37,211,102,.3); }
  </style>
</head>

<body class="bg-[#F8FAFC]">
  <div class="bg-gray-900 text-white py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
    MARKETPLACE PROFESSIONNELLE • LIVRAISON INTERNATIONALE • PAIEMENT SÉCURISÉ
  </div>

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/95">
    <div class="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
      <a href="/index.html" class="flex items-center gap-2 shrink-0">
        <div class="text-2xl font-black tracking-tighter text-gray-900">Viral<span class="text-[#F07E13]">Flowr</span></div>
      </a>
      <a href="https://wa.me/+243850373991" target="_blank" class="btn-support">Aide</a>
    </div>
  </header>

  <main class="max-w-[1280px] mx-auto px-4 py-8">
    <div class="grid md:grid-cols-2 gap-8">
      <div class="hover-card bg-white rounded-[30px] p-4 border border-gray-50 shadow-sm">
        <div class="aspect-square bg-[#F8FAFC] rounded-[22px] flex items-center justify-center p-6 overflow-hidden">
          <img src="${escHtml(imgRaw || ogImg)}" class="w-full h-full object-contain" alt="${escHtml(nom)}"
               onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'">
        </div>
      </div>

      <div class="hover-card bg-white rounded-[30px] p-6 md:p-8 border border-gray-50 shadow-sm">
        <span class="text-[10px] font-black text-[#F07E13] uppercase tracking-widest">${escHtml(cat)}</span>
        <h1 class="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-4">${escHtml(nom)}</h1>

        <div class="text-4xl font-black tracking-tighter text-gray-900 mb-4">${escHtml(prix)} $</div>

        ${(longDesc || desc) ? `
        <div class="space-y-3">
          ${longDesc ? `
          <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <h3 class="text-blue-800 text-xs font-black uppercase mb-2">📝 Description du produit</h3>
            <p class="text-xs text-blue-900 leading-relaxed whitespace-pre-line font-medium">${escHtml(longDesc)}</p>
          </div>` : ""}

          ${desc ? `
          <div class="bg-green-50 border border-green-100 rounded-2xl p-4">
            <h3 class="text-green-800 text-xs font-black uppercase mb-2">📄 Instructions</h3>
            <p class="text-xs text-green-900 leading-relaxed whitespace-pre-line font-medium">${escHtml(desc)}</p>
          </div>` : ""}
        </div>` : ""}

        <div class="mt-6 grid grid-cols-2 gap-3">
          <a href="${escHtml(payUrl)}"
             class="brand-gradient text-white py-4 rounded-2xl font-black text-sm uppercase text-center shadow-xl hover:scale-[1.02] transition-transform">
            Commander
          </a>
          <a href="/share/${encodeURIComponent(id)}/"
             class="bg-gray-900 text-white py-4 rounded-2xl font-black text-sm uppercase text-center hover:bg-gray-800 transition-colors">
            Partager
          </a>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

function templateSharePage(p) {
  const id = safe(p.id).trim();
  const nom = safe(p.nom).trim() || `Produit ${id}`;
  const cat = safe(p.cat).trim() || "Service";
  const prix = safe(p.prix).trim() || "0";

  const imgRaw = safe(p.img).trim();
  const ogImg = toDirectOGImage(imgRaw) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  const payUrl = buildPayUrl(p);
  const ogDesc = `${prix} $ • ${cat}`.slice(0, 200);

  // page ultra light: OG + redirect
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(nom)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(ogDesc)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(nom)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImg)}">
  <meta property="og:url" content="https://viralflowr.com/share/${encodeURIComponent(id)}/">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(ogImg)}">

  <meta http-equiv="refresh" content="0;url=${escHtml(payUrl)}">
</head>
<body>
  <a href="${escHtml(payUrl)}">Ouvrir la commande</a>
</body>
</html>`;
}

// ---------- main ----------
async function main() {
  const products = await fetchProducts();

  // clean generated dirs
  rmDir("p");
  rmDir("share");
  ensureDir("p");
  ensureDir("share");

  let count = 0;

  for (const p of products) {
    const id = safe(p.id).trim();
    if (!id) continue;

    // product pages
    const pDir = path.join("p", id);
    ensureDir(pDir);
    fs.writeFileSync(path.join(pDir, "index.html"), templateProductPage(p), "utf-8");

    // share pages (preview)
    const sDir = path.join("share", id);
    ensureDir(sDir);
    fs.writeFileSync(path.join(sDir, "index.html"), templateSharePage(p), "utf-8");

    count++;
  }

  console.log(`✅ Pages générées: ${count} produits (p/* + share/*).`);
}

main().catch((e) => {
  console.error("❌ Erreur:", e);
  process.exit(1);
});
