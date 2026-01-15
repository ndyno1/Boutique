import fs from "fs";
import path from "path";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec";
const SITE = "https://viralflowr.com";

function escHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safe(s = "") { return String(s ?? "").trim(); }

async function fetchProducts() {
  const cb = "cb";
  const url = `${SCRIPT_URL}?action=get_products&callback=${cb}&t=${Date.now()}`;
  const res = await fetch(url);
  const text = await res.text();

  // Parse JSONP: cb([...])
  const start = text.indexOf(`${cb}(`);
  const end = text.lastIndexOf(")");
  if (start === -1 || end === -1) throw new Error("Bad JSONP response");
  const json = text.slice(start + cb.length + 1, end);
  const data = JSON.parse(json);
  return Array.isArray(data) ? data : [];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(fp, content) {
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, "utf8");
}

function buildProductPage(p) {
  const id = safe(p.id);
  const title = safe(p.nom) || `Produit ${id}`;
  const cat = safe(p.cat) || "Produit";
  const price = safe(p.prix) || "";
  const img = safe(p.img) || `${SITE}/assets/og/default.jpg`;

  const ogUrl = `${SITE}/p/${encodeURIComponent(id)}`;
  const payUrl = `${SITE}/paiement.html?id=${encodeURIComponent(id)}`;

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(title)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(cat)} • ${escHtml(price)} $ • ViralFlowr">

  <!-- Open Graph (WhatsApp/Facebook) -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(title)}">
  <meta property="og:description" content="${escHtml(cat)} • ${escHtml(price)} $">
  <meta property="og:image" content="${escHtml(img)}">
  <meta property="og:url" content="${escHtml(ogUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(img)}">

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; scroll-behavior: smooth; }
    .brand-gradient { background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%); }
    .hover-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .hover-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); border-color: #F07E13; }
    .btn-support { background: #25D366; color: white; padding: 8px 16px; border-radius: 12px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 8px; transition: 0.3s; }
    .btn-support:hover { transform: scale(1.05); box-shadow: 0 10px 15px -3px rgba(37, 211, 102, 0.3); }
  </style>
</head>
<body class="bg-[#F8FAFC]">
  <div class="bg-gray-900 text-white py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
    MARKETPLACE PROFESSIONNELLE • LIVRAISON INTERNATIONALE • PAIEMENT SÉCURISÉ
  </div>

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/95">
    <div class="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
      <a href="/index.html" class="flex items-center gap-2 shrink-0">
        <div class="text-2xl font-black tracking-tighter text-gray-900">
          Viral<span class="text-[#F07E13]">Flowr</span>
        </div>
      </a>

      <a href="https://wa.me/+243850373991" target="_blank" class="btn-support">Aide</a>
    </div>
  </header>

  <main class="max-w-[1280px] mx-auto px-4 py-8">
    <div class="grid md:grid-cols-2 gap-6">
      <div class="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
        <div class="aspect-square bg-[#F8FAFC] rounded-[26px] overflow-hidden flex items-center justify-center p-6">
          <img src="${escHtml(img)}" alt="${escHtml(title)}" class="w-full h-full object-contain"
               onerror="this.src='${SITE}/assets/og/default.jpg'">
        </div>
      </div>

      <div class="bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm">
        <span class="text-[10px] font-black text-[#F07E13] uppercase tracking-widest">${escHtml(cat)}</span>
        <h1 class="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-4">${escHtml(title)}</h1>

        <div class="text-4xl font-black tracking-tighter text-gray-900 mb-6">${escHtml(price || "0")} $</div>

        <div class="flex gap-3">
          <a href="${escHtml(payUrl)}"
             class="flex-1 brand-gradient text-white py-4 rounded-2xl font-black text-sm uppercase text-center shadow-xl hover:scale-[1.02] transition-transform">
            Commander
          </a>
          <a href="/share/${encodeURIComponent(id)}"
             class="px-5 py-4 rounded-2xl font-black text-sm uppercase border border-gray-200 bg-white hover:bg-gray-50 transition">
            Partager
          </a>
        </div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

function buildSharePage(p) {
  const id = safe(p.id);
  const title = safe(p.nom) || `Produit ${id}`;
  const cat = safe(p.cat) || "Produit";
  const price = safe(p.prix) || "";
  const img = safe(p.img) || `${SITE}/assets/og/default.jpg`;

  const shareUrl = `${SITE}/share/${encodeURIComponent(id)}`;
  const redirectUrl = `${SITE}/p/${encodeURIComponent(id)}`; // ou /paiement.html?id=ID si tu veux direct

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title>${escHtml(title)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(cat)} • ${escHtml(price)} $">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(title)}">
  <meta property="og:description" content="${escHtml(cat)} • ${escHtml(price)} $">
  <meta property="og:image" content="${escHtml(img)}">
  <meta property="og:url" content="${escHtml(shareUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(img)}">

  <meta http-equiv="refresh" content="0;url=${escHtml(redirectUrl)}">
</head>
<body>
  <a href="${escHtml(redirectUrl)}">Ouvrir</a>
</body>
</html>`;
}

async function main() {
  const products = await fetchProducts();
  if (!products.length) {
    console.log("Aucun produit trouvé.");
    return;
  }

  // IMPORTANT: assure-toi qu'il n'existe pas un fichier nommé "p" ou "share"
  // sinon GitHub te bloque la création des dossiers.
  // (si tu as un fichier 'share' à la racine, renomme-le)

  for (const p of products) {
    const id = safe(p.id);
    if (!id) continue;

    writeFile(`p/${id}/index.html`, buildProductPage(p));
    writeFile(`share/${id}/index.html`, buildSharePage(p));
  }

  console.log(`Généré: ${products.length} produits`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
