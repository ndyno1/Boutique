// scripts/generate-pages.mjs
import fs from "fs";
import path from "path";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec";

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

  if (u.includes("lh3.googleusercontent.com/d/")) {
    return u.includes("=") ? u : `${u}=w1200`;
  }

  const m1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m1 && m1[1]) return `https://lh3.googleusercontent.com/d/${m1[1]}=w1200`;

  const m2 = u.match(/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2 && m2[1]) return `https://lh3.googleusercontent.com/d/${m2[1]}=w1200`;

  if (/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(u)) return u;

  return u;
}

// ✅ Paiement: utilise C via p.desc
function buildPayUrl(p) {
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id", safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("img", safe(p.img || ""));

  // ✅ C = desc (paiement.html)
  qp.set("desc", safe(p.desc).trim());

  // IMPORTANT: ne pas envoyer long => paiement n'affiche pas long_box
  return `/paiement.html?${qp.toString()}`;
}

async function fetchProducts() {
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
  const cat = safe(p.cat).trim() || "Catalogue";
  const prix = safe(p.prix).trim() || "0";

  const imgRaw = safe(p.img).trim();
  const ogImg = toDirectOGImage(imgRaw) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  // ✅ K = long_desc (page produit)
  const longDesc = safe(p.long_desc).trim();

  const payUrl = buildPayUrl(p);

  const ogDesc = `${prix} $ • ${cat}${longDesc ? " • " + longDesc.replace(/\s+/g, " ").slice(0, 120) : ""}`.slice(0, 200);

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escHtml(nom)} | ViralFlowr</title>
  <meta name="description" content="${escHtml(ogDesc)}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${escHtml(nom)}">
  <meta property="og:description" content="${escHtml(ogDesc)}">
  <meta property="og:image" content="${escHtml(ogImg)}">
  <meta property="og:url" content="https://viralflowr.com/p/${encodeURIComponent(id)}/">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${escHtml(ogImg)}">

  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    body { font-family: 'Inter', sans-serif; background-color: #F3F3F3; color: #201B16; }
    .text-orange-bsv { color: #F07E13; }
    .btn-gradient { background: linear-gradient(90deg, #F07E13 0%, #FFB26B 100%); }
    .btn-gradient:hover { background: linear-gradient(90deg, #d96d0c 0%, #F07E13 100%); }
    .shadow-card { box-shadow: 0 0 7px 0 rgba(0,0,0,.15); }
  </style>
</head>

<body class="flex flex-col min-h-screen">

  <header class="bg-white sticky top-0 w-full z-50 border-b border-gray-200 shadow-sm">
    <div class="max-w-[1240px] mx-auto h-16 px-4 flex items-center justify-between gap-4">
      <a class="flex items-center gap-2" href="/index.html">
        <div class="text-2xl font-black tracking-tighter">
          Viral<span class="text-orange-bsv">Flowr</span>
        </div>
      </a>
      <a href="/index.html" class="hidden md:flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors">
        Retour
      </a>
    </div>
  </header>

  <main class="flex-1 mt-6 lg:mt-10 mb-20">
    <div class="max-w-[1240px] mx-auto px-3 md:px-4 flex flex-col gap-6">

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

        <div class="flex flex-col gap-6">
          <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 md:p-8">
            <h1 class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">${escHtml(nom)}</h1>

            <div class="flex flex-col sm:flex-row gap-6">
              <div class="shrink-0">
                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                  <img src="${escHtml(imgRaw || ogImg)}" class="w-full h-full object-contain"
                       onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"
                       alt="${escHtml(nom)}">
                </div>
              </div>

              <div class="flex-1">
                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                <div class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium">
                  ${escHtml(longDesc || "Aucune description.")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-6">
            <div class="grid grid-cols-2 gap-4 items-end">
              <div>
                <span class="text-gray-500 text-xs font-medium block mb-1">Prix Total:</span>
                <span class="text-3xl font-black text-[#201B16] tracking-tighter">${escHtml(prix)} $</span>
              </div>
              <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                <span>Min : <strong class="text-gray-700">${escHtml(safe(p.min) || "1")}</strong></span>
                <span>Max : <strong class="text-gray-700">${escHtml(safe(p.max) || "∞")}</strong></span>
              </div>
            </div>

            <a href="${escHtml(payUrl)}"
               class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center">
              Acheter maintenant
            </a>

            <a href="/share/${encodeURIComponent(id)}/"
               class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold hover:text-orange-500 transition-colors">
              Partager ce produit
            </a>
          </div>
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

  rmDir("p");
  rmDir("share");
  ensureDir("p");
  ensureDir("share");

  let count = 0;

  for (const p of products) {
    const id = safe(p.id).trim();
    if (!id) continue;

    const pDir = path.join("p", id);
    ensureDir(pDir);
    fs.writeFileSync(path.join(pDir, "index.html"), templateProductPage(p), "utf-8");

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
