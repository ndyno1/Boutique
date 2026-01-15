import fs from "fs";
import path from "path";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec";
const SITE = "https://viralflowr.com";

// image fallback si p.img vide
const FALLBACK_IMG = "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

function escHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function safe(s = "") { return String(s ?? "").trim(); }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeFile(fp, content) {
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, content, "utf8");
}

// JSONP get_products => cb([...])
async function fetchProducts() {
  const cb = "cb";
  const url = `${SCRIPT_URL}?action=get_products&callback=${cb}&t=${Date.now()}`;
  const res = await fetch(url);
  const text = await res.text();

  const start = text.indexOf(`${cb}(`);
  const end = text.lastIndexOf(")");
  if (start === -1 || end === -1) throw new Error("BAD_JSONP");

  const json = text.slice(start + cb.length + 1, end);
  const data = JSON.parse(json);
  return Array.isArray(data) ? data : [];
}

function buildPayUrl(p) {
  // Si tu veux garder pay_link en priorité
  const payLink = safe(p.pay_link || p.payLink);
  if (payLink) return payLink;

  // sinon paiement.html avec tes paramètres (comme ton index)
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id",  safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("desc", safe(p.desc || p.description));
  qp.set("long", safe(p.long_desc || p.long || p.longDescription));
  return `${SITE}/paiement.html?` + qp.toString();
}

function buildProductPage(p) {
  const id = safe(p.id);
  const title = safe(p.nom) || `Produit ${id}`;
  const cat = safe(p.cat) || "Produit";
  const price = safe(p.prix) || "0";
  const img = safe(p.img) || FALLBACK_IMG;

  const ogUrl = `${SITE}/p/${encodeURIComponent(id)}/`;
  const shareUrl = `${SITE}/share/${encodeURIComponent(id)}/`;
  const payUrl = buildPayUrl(p);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(cat)} • ${escHtml(price)} $ • Paiement sécurisé">

  <!-- OG (WhatsApp/Facebook/Insta/Snap) -->
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
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .brand-gradient { background: linear-gradient(135deg, #F07E13 0%, #FFB26B 100%); }
    .hover-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .hover-card:hover { transform: translateY(-6px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); border-color: #F07E13; }
    .btn-support { background: #25D366; color: white; padding: 8px 16px; border-radius: 12px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 8px; transition: 0.3s; }
    .btn-support:hover { transform: scale(1.05); box-shadow: 0 10px 15px -3px rgba(37, 211, 102, 0.3); }
    .line-clamp-2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  </style>
</head>

<body class="bg-[#F8FAFC]">
  <div class="bg-gray-900 text-white py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-center">
    MARKETPLACE PROFESSIONNELLE • LIVRAISON INTERNATIONALE • PAIEMENT SÉCURISÉ
  </div>

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/95">
    <div class="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
      <a href="${SITE}/index.html" class="flex items-center gap-2 shrink-0">
        <div class="text-2xl font-black tracking-tighter text-gray-900">
          Viral<span class="text-[#F07E13]">Flowr</span>
        </div>
      </a>

      <div class="flex items-center gap-3">
        <a href="https://wa.me/+243850373991" target="_blank" class="btn-support">Aide</a>
      </div>
    </div>
  </header>

  <main class="max-w-[1280px] mx-auto px-4 py-10">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">

      <div class="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
        <div class="aspect-square bg-[#F8FAFC] rounded-[26px] overflow-hidden flex items-center justify-center p-6">
          <img src="${escHtml(img)}"
               class="w-full h-full object-contain"
               alt="${escHtml(title)}"
               onerror="this.src='${escHtml(FALLBACK_IMG)}'">
        </div>
      </div>

      <div class="bg-white rounded-[32px] p-6 md:p-8 border border-gray-100 shadow-sm">
        <span class="text-[10px] font-black text-[#F07E13] uppercase tracking-widest">${escHtml(cat)}</span>

        <h1 class="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-4">${escHtml(title)}</h1>

        <div class="text-4xl font-black tracking-tighter text-gray-900 mb-6">${escHtml(price)} $</div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="${escHtml(payUrl)}"
             class="w-full brand-gradient text-white py-4 rounded-2xl font-black text-sm uppercase text-center shadow-xl hover:scale-[1.02] transition-transform">
            Commander
          </a>

          <a href="${escHtml(shareUrl)}"
             class="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-sm uppercase text-center hover:bg-gray-800 transition-colors">
            Partager
          </a>
        </div>

        <div class="mt-6 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Lien partage</div>
          <div class="text-xs font-bold text-gray-900 break-all">${escHtml(shareUrl)}</div>
          <div class="text-[10px] text-gray-400 font-bold mt-2">
            Astuce cache WhatsApp : ajoute <span class="text-gray-900">?v=1</span> si le preview ne change pas.
          </div>
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
  const price = safe(p.prix) || "0";
  const img = safe(p.img) || FALLBACK_IMG;

  // URL où WA lit OG
  const shareUrl = `${SITE}/share/${encodeURIComponent(id)}/`;

  // redirection humains (après preview) => page produit
  const redirectUrl = `${SITE}/p/${encodeURIComponent(id)}/`;

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

  // IMPORTANT: il ne doit PAS exister un fichier "p" ou "share" à la racine
  // sinon GitHub empêche de créer les dossiers.
  for (const p of products) {
    const id = safe(p.id);
    if (!id) continue;

    writeFile(`p/${id}/index.html`, buildProductPage(p));
    writeFile(`share/${id}/index.html`, buildSharePage(p));
  }

  console.log(`✅ Généré: ${products.length} pages produits + share`);
}

main().catch(err => {
  console.error("❌", err);
  process.exit(1);
});
