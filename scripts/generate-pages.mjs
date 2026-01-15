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

// ✅ strict mapping
// - Produit: description = colonne K (champ k/K)
// - Paiement: description = colonne C (champ c/C)
const fromK = (p) => safe(p?.k ?? p?.K).trim();
const fromC = (p) => safe(p?.c ?? p?.C).trim();

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
  // ✅ Paiement: envoie seulement colonne C dans desc
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id", safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("desc", fromC(p));         // ✅ colonne C only
  qp.set("img", safe(p.img || "")); // optionnel
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
  const cat = safe(p.cat).trim() || "Catalogue";

  const prixNum = parseFloat(safe(p.prix).trim() || "0") || 0;

  const imgRaw = safe(p.img).trim();
  const img = imgRaw || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const ogImg = toDirectOGImage(img) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  // ✅ Produit: affiche seulement colonne K
  const descK = fromK(p);

  const minQ = parseInt(safe(p.min).trim() || "1", 10) || 1;
  const maxQ = parseInt(safe(p.max).trim() || "0", 10) || 0; // 0 = illimité

  // base payment url (qty ajouté côté JS)
  const payBase = buildPayUrl({ ...p, id, nom, cat, prix: prixNum, img });

  const ogDesc = `${prixNum} $ • ${cat}${descK ? " • " + descK.replace(/\s+/g, " ").slice(0, 140) : ""}`.slice(0, 200);

  const productJson = JSON.stringify({
    id,
    nom,
    cat,
    prix: prixNum,
    img,
    desc: descK,     // ✅ K only
    min: minQ,
    max: maxQ,
    payBase
  });

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <style>
        body { font-family: 'Inter', sans-serif; background-color: #F3F3F3; color: #201B16; }
        .text-orange-bsv { color: #F07E13; }
        .bg-orange-bsv { background-color: #F07E13; }
        /* Dégradé exact du bouton BuySellVouchers */
        .btn-gradient { background: linear-gradient(90deg, #F07E13 0%, #FFB26B 100%); }
        .btn-gradient:hover { background: linear-gradient(90deg, #d96d0c 0%, #F07E13 100%); }
        .shadow-card { box-shadow: 0 0 7px 0 rgba(0,0,0,.15); }

        /* Animation chargement */
        .skeleton { background: #eee; background: linear-gradient(110deg, #ececec 8%, #f5f5f5 18%, #ececec 33%); background-size: 200% 100%; animation: 1.5s shine linear infinite; }
        @keyframes shine { to { background-position-x: -200%; } }
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
            <div class="flex items-center gap-4">
                <a href="/index.html" class="hidden md:flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    Retour
                </a>
            </div>
        </div>
    </header>

    <main class="flex-1 mt-6 lg:mt-10 mb-20">
        <div class="max-w-[1240px] mx-auto px-3 md:px-4 flex flex-col gap-6">

            <div class="flex items-center gap-2 text-[13px] text-[#767676] font-medium overflow-x-auto whitespace-nowrap pb-2">
                <a href="/index.html" class="hover:underline">Accueil</a>
                <span>/</span>
                <a href="#" class="hover:underline" id="bread-cat">Catalogue</a>
                <span>/</span>
                <span class="text-black font-semibold" id="bread-name">Chargement...</span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                <div class="flex flex-col gap-6">

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 md:p-8">
                        <h1 id="product-title" class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">
                            <div class="h-8 w-3/4 skeleton rounded"></div>
                        </h1>

                        <div class="flex flex-col sm:flex-row gap-6">
                            <div class="shrink-0">
                                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                                    <img id="product-img" src="" class="w-full h-full object-contain transition-opacity duration-500 opacity-0"
                                         onload="this.classList.remove('opacity-0')"
                                         onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"
                                         alt="Product">
                                </div>
                            </div>

                            <div class="flex-1">
                                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                                <div id="product-desc" class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium">
                                    <div class="space-y-2">
                                        <div class="h-4 w-full skeleton rounded"></div>
                                        <div class="h-4 w-5/6 skeleton rounded"></div>
                                        <div class="h-4 w-4/6 skeleton rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="hidden lg:block">
                        <h3 class="text-[#18181B] text-2xl font-bold mb-6">Avis récents (Feedbacks)</h3>
                        <div class="flex flex-col gap-3">
                            <div class="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                    <img src="https://cdn.bsvmarket.com/images/dashboard/feedback_pos.svg" width="16">
                                    <span>Il y a 2 heures</span>
                                </div>
                                <p class="text-sm font-medium text-gray-800">Code reçu instantanément. Service parfait pour Kinshasa !</p>
                            </div>
                            <div class="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                    <img src="https://cdn.bsvmarket.com/images/dashboard/feedback_pos.svg" width="16">
                                    <span>Il y a 5 heures</span>
                                </div>
                                <p class="text-sm font-medium text-gray-800">Transaction sécurisée avec Binance. Je recommande.</p>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="flex flex-col gap-4">

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-6 relative overflow-hidden">

                        <div class="flex justify-between items-center border-b border-gray-100 pb-4">
                            <span class="text-gray-500 text-sm font-medium">Région :</span>
                            <div class="flex items-center gap-2">
                                <img src="https://cdn.bsvmarket.com/images/flags/4x3/ww.svg" class="w-5 h-5 rounded-full border border-gray-200">
                                <span class="text-sm font-bold text-black">Global / Afrique</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <span class="text-gray-500 text-xs font-medium block mb-1">Prix Total:</span>
                                <span id="display-price" class="text-3xl font-black text-[#201B16] tracking-tighter">-- $</span>
                            </div>

                            <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                                <span>Min : <strong id="min-q" class="text-gray-700">1</strong></span>
                                <span>Max : <strong id="max-q" class="text-gray-700">∞</strong></span>
                            </div>
                        </div>

                        <div class="flex items-center rounded-full border border-gray-200 bg-white h-10 w-max mx-auto">
                            <button onclick="updateQty(-1)" class="w-10 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-full text-lg transition">-</button>
                            <input id="qty-input" type="text" value="1" readonly class="w-12 text-center text-sm font-bold text-gray-900 border-none outline-none">
                            <button onclick="updateQty(1)" class="w-10 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-full text-lg transition">+</button>
                        </div>

                        <button onclick="goToCheckout()" class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
                            Acheter maintenant
                        </button>

                        <button onclick="shareProduct()" class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold hover:text-orange-500 transition-colors">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            Partager ce produit
                        </button>
                    </div>

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6">
                        <div class="flex items-center gap-3 mb-6">
                            <div class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-xs border-2 border-white shadow-md">VF</div>
                            <div>
                                <div class="text-sm font-bold text-[#18181B]">ViralFlowr Store</div>
                                <div class="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Vendeur Vérifié
                                </div>
                            </div>
                        </div>

                        <div class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Crypto acceptée :</div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-orange-50 hover:border-orange-200 transition-colors cursor-default">
                                <img src="https://cdn.bsvmarket.com/images/currencies/trc20.png" class="w-5 h-5">
                                <span class="text-xs font-bold text-gray-700">USDT</span>
                            </div>
                            <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-yellow-50 hover:border-yellow-200 transition-colors cursor-default">
                                <img src="https://cdn.bsvmarket.com/uploads/bnb_usdt_886a8f62e2.svg" class="w-5 h-5">
                                <span class="text-xs font-bold text-gray-700">Binance</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </main>

    <footer class="bg-white border-t border-gray-100 py-8">
        <div class="max-w-[1240px] mx-auto px-4 text-center">
            <p class="text-[11px] text-[#767676]">© 2026 ViralFlowr Marketplace. Paiements sécurisés et livraison rapide.</p>
        </div>
    </footer>

    <script>
      const PRODUCT = ${productJson};

      let currentPrice = parseFloat(PRODUCT.prix) || 0;
      const productNom = PRODUCT.nom;

      const minQ = parseInt(PRODUCT.min) || 1;
      const maxQ = parseInt(PRODUCT.max) || 0; // 0 = illimité

      // UI
      document.getElementById('product-title').textContent = PRODUCT.nom;
      document.getElementById('bread-name').textContent = PRODUCT.nom;
      document.getElementById('bread-cat').textContent = PRODUCT.cat || 'Catalogue';
      document.getElementById('product-img').src = PRODUCT.img || 'https://cdn-icons-png.flaticon.com/512/11520/11520110.png';

      document.getElementById('min-q').textContent = String(minQ);
      document.getElementById('max-q').textContent = maxQ > 0 ? String(maxQ) : "∞";

      // ✅ Produit: affiche seulement K
      document.getElementById('product-desc').textContent = PRODUCT.desc || "Aucune description.";

      // qty démarre au min
      document.getElementById('qty-input').value = String(minQ);

      function updateQty(change) {
        const qtyInput = document.getElementById('qty-input');
        let val = parseInt(qtyInput.value, 10) + change;
        if (isNaN(val)) val = minQ;

        if (val < minQ) val = minQ;
        if (maxQ > 0 && val > maxQ) val = maxQ;

        qtyInput.value = val;

        const total = (currentPrice * val).toFixed(2);
        document.getElementById('display-price').textContent = total + " $";
      }

      function shareProduct() {
        const url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: productNom, text: 'Regarde ce produit sur ViralFlowr !', url });
        } else {
          navigator.clipboard.writeText(url);
          alert("Lien copié dans le presse-papier !");
        }
      }

      function goToCheckout() {
        const qty = document.getElementById('qty-input').value;
        const sep = PRODUCT.payBase.includes("?") ? "&" : "?";
        window.location.href = PRODUCT.payBase + sep + "qty=" + encodeURIComponent(qty);
      }

      // init
      updateQty(0);

      // expose globals for onclick
      window.updateQty = updateQty;
      window.shareProduct = shareProduct;
      window.goToCheckout = goToCheckout;
    </script>
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

  const payUrl = buildPayUrl({ ...p, img: imgRaw });
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

// ✅ strict mapping
// - Produit: description = colonne K (champ k/K)
// - Paiement: description = colonne C (champ c/C)
const fromK = (p) => safe(p?.k ?? p?.K).trim();
const fromC = (p) => safe(p?.c ?? p?.C).trim();

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
  // ✅ Paiement: envoie seulement colonne C dans desc
  const qp = new URLSearchParams();
  qp.set("nom", safe(p.nom));
  qp.set("prix", safe(p.prix));
  qp.set("cat", safe(p.cat));
  qp.set("id", safe(p.id));
  qp.set("min", safe(p.min));
  qp.set("max", safe(p.max));
  qp.set("desc", fromC(p));         // ✅ colonne C only
  qp.set("img", safe(p.img || "")); // optionnel
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
  const cat = safe(p.cat).trim() || "Catalogue";

  const prixNum = parseFloat(safe(p.prix).trim() || "0") || 0;

  const imgRaw = safe(p.img).trim();
  const img = imgRaw || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const ogImg = toDirectOGImage(img) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";

  // ✅ Produit: affiche seulement colonne K
  const descK = fromK(p);

  const minQ = parseInt(safe(p.min).trim() || "1", 10) || 1;
  const maxQ = parseInt(safe(p.max).trim() || "0", 10) || 0; // 0 = illimité

  // base payment url (qty ajouté côté JS)
  const payBase = buildPayUrl({ ...p, id, nom, cat, prix: prixNum, img });

  const ogDesc = `${prixNum} $ • ${cat}${descK ? " • " + descK.replace(/\s+/g, " ").slice(0, 140) : ""}`.slice(0, 200);

  const productJson = JSON.stringify({
    id,
    nom,
    cat,
    prix: prixNum,
    img,
    desc: descK,     // ✅ K only
    min: minQ,
    max: maxQ,
    payBase
  });

  return `<!DOCTYPE html>
<html lang="fr" class="font-inter">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <style>
        body { font-family: 'Inter', sans-serif; background-color: #F3F3F3; color: #201B16; }
        .text-orange-bsv { color: #F07E13; }
        .bg-orange-bsv { background-color: #F07E13; }
        /* Dégradé exact du bouton BuySellVouchers */
        .btn-gradient { background: linear-gradient(90deg, #F07E13 0%, #FFB26B 100%); }
        .btn-gradient:hover { background: linear-gradient(90deg, #d96d0c 0%, #F07E13 100%); }
        .shadow-card { box-shadow: 0 0 7px 0 rgba(0,0,0,.15); }

        /* Animation chargement */
        .skeleton { background: #eee; background: linear-gradient(110deg, #ececec 8%, #f5f5f5 18%, #ececec 33%); background-size: 200% 100%; animation: 1.5s shine linear infinite; }
        @keyframes shine { to { background-position-x: -200%; } }
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
            <div class="flex items-center gap-4">
                <a href="/index.html" class="hidden md:flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    Retour
                </a>
            </div>
        </div>
    </header>

    <main class="flex-1 mt-6 lg:mt-10 mb-20">
        <div class="max-w-[1240px] mx-auto px-3 md:px-4 flex flex-col gap-6">

            <div class="flex items-center gap-2 text-[13px] text-[#767676] font-medium overflow-x-auto whitespace-nowrap pb-2">
                <a href="/index.html" class="hover:underline">Accueil</a>
                <span>/</span>
                <a href="#" class="hover:underline" id="bread-cat">Catalogue</a>
                <span>/</span>
                <span class="text-black font-semibold" id="bread-name">Chargement...</span>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                <div class="flex flex-col gap-6">

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 md:p-8">
                        <h1 id="product-title" class="text-[#18181B] font-bold text-2xl md:text-3xl leading-tight mb-6">
                            <div class="h-8 w-3/4 skeleton rounded"></div>
                        </h1>

                        <div class="flex flex-col sm:flex-row gap-6">
                            <div class="shrink-0">
                                <div class="w-[140px] h-[140px] bg-[#F8FAFC] rounded-2xl border border-gray-100 flex items-center justify-center p-4">
                                    <img id="product-img" src="" class="w-full h-full object-contain transition-opacity duration-500 opacity-0"
                                         onload="this.classList.remove('opacity-0')"
                                         onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"
                                         alt="Product">
                                </div>
                            </div>

                            <div class="flex-1">
                                <span class="text-[#767676] text-xs font-bold uppercase tracking-wider mb-2 block">Description :</span>
                                <div id="product-desc" class="text-sm text-[#515052] leading-relaxed whitespace-pre-line font-medium">
                                    <div class="space-y-2">
                                        <div class="h-4 w-full skeleton rounded"></div>
                                        <div class="h-4 w-5/6 skeleton rounded"></div>
                                        <div class="h-4 w-4/6 skeleton rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="hidden lg:block">
                        <h3 class="text-[#18181B] text-2xl font-bold mb-6">Avis récents (Feedbacks)</h3>
                        <div class="flex flex-col gap-3">
                            <div class="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                    <img src="https://cdn.bsvmarket.com/images/dashboard/feedback_pos.svg" width="16">
                                    <span>Il y a 2 heures</span>
                                </div>
                                <p class="text-sm font-medium text-gray-800">Code reçu instantanément. Service parfait pour Kinshasa !</p>
                            </div>
                            <div class="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                <div class="flex items-center gap-2 text-xs text-gray-500">
                                    <img src="https://cdn.bsvmarket.com/images/dashboard/feedback_pos.svg" width="16">
                                    <span>Il y a 5 heures</span>
                                </div>
                                <p class="text-sm font-medium text-gray-800">Transaction sécurisée avec Binance. Je recommande.</p>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="flex flex-col gap-4">

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6 flex flex-col gap-6 relative overflow-hidden">

                        <div class="flex justify-between items-center border-b border-gray-100 pb-4">
                            <span class="text-gray-500 text-sm font-medium">Région :</span>
                            <div class="flex items-center gap-2">
                                <img src="https://cdn.bsvmarket.com/images/flags/4x3/ww.svg" class="w-5 h-5 rounded-full border border-gray-200">
                                <span class="text-sm font-bold text-black">Global / Afrique</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <span class="text-gray-500 text-xs font-medium block mb-1">Prix Total:</span>
                                <span id="display-price" class="text-3xl font-black text-[#201B16] tracking-tighter">-- $</span>
                            </div>

                            <div class="flex flex-col text-right text-[11px] text-gray-400 font-medium">
                                <span>Min : <strong id="min-q" class="text-gray-700">1</strong></span>
                                <span>Max : <strong id="max-q" class="text-gray-700">∞</strong></span>
                            </div>
                        </div>

                        <div class="flex items-center rounded-full border border-gray-200 bg-white h-10 w-max mx-auto">
                            <button onclick="updateQty(-1)" class="w-10 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-full text-lg transition">-</button>
                            <input id="qty-input" type="text" value="1" readonly class="w-12 text-center text-sm font-bold text-gray-900 border-none outline-none">
                            <button onclick="updateQty(1)" class="w-10 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-full text-lg transition">+</button>
                        </div>

                        <button onclick="goToCheckout()" class="w-full h-12 rounded-full btn-gradient text-white font-bold text-[15px] uppercase tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
                            Acheter maintenant
                        </button>

                        <button onclick="shareProduct()" class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold hover:text-orange-500 transition-colors">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            Partager ce produit
                        </button>
                    </div>

                    <div class="bg-white border border-gray-100 shadow-card rounded-xl p-6">
                        <div class="flex items-center gap-3 mb-6">
                            <div class="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-xs border-2 border-white shadow-md">VF</div>
                            <div>
                                <div class="text-sm font-bold text-[#18181B]">ViralFlowr Store</div>
                                <div class="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Vendeur Vérifié
                                </div>
                            </div>
                        </div>

                        <div class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Crypto acceptée :</div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-orange-50 hover:border-orange-200 transition-colors cursor-default">
                                <img src="https://cdn.bsvmarket.com/images/currencies/trc20.png" class="w-5 h-5">
                                <span class="text-xs font-bold text-gray-700">USDT</span>
                            </div>
                            <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-yellow-50 hover:border-yellow-200 transition-colors cursor-default">
                                <img src="https://cdn.bsvmarket.com/uploads/bnb_usdt_886a8f62e2.svg" class="w-5 h-5">
                                <span class="text-xs font-bold text-gray-700">Binance</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </main>

    <footer class="bg-white border-t border-gray-100 py-8">
        <div class="max-w-[1240px] mx-auto px-4 text-center">
            <p class="text-[11px] text-[#767676]">© 2026 ViralFlowr Marketplace. Paiements sécurisés et livraison rapide.</p>
        </div>
    </footer>

    <script>
      const PRODUCT = ${productJson};

      let currentPrice = parseFloat(PRODUCT.prix) || 0;
      const productNom = PRODUCT.nom;

      const minQ = parseInt(PRODUCT.min) || 1;
      const maxQ = parseInt(PRODUCT.max) || 0; // 0 = illimité

      // UI
      document.getElementById('product-title').textContent = PRODUCT.nom;
      document.getElementById('bread-name').textContent = PRODUCT.nom;
      document.getElementById('bread-cat').textContent = PRODUCT.cat || 'Catalogue';
      document.getElementById('product-img').src = PRODUCT.img || 'https://cdn-icons-png.flaticon.com/512/11520/11520110.png';

      document.getElementById('min-q').textContent = String(minQ);
      document.getElementById('max-q').textContent = maxQ > 0 ? String(maxQ) : "∞";

      // ✅ Produit: affiche seulement K
      document.getElementById('product-desc').textContent = PRODUCT.desc || "Aucune description.";

      // qty démarre au min
      document.getElementById('qty-input').value = String(minQ);

      function updateQty(change) {
        const qtyInput = document.getElementById('qty-input');
        let val = parseInt(qtyInput.value, 10) + change;
        if (isNaN(val)) val = minQ;

        if (val < minQ) val = minQ;
        if (maxQ > 0 && val > maxQ) val = maxQ;

        qtyInput.value = val;

        const total = (currentPrice * val).toFixed(2);
        document.getElementById('display-price').textContent = total + " $";
      }

      function shareProduct() {
        const url = window.location.href;
        if (navigator.share) {
          navigator.share({ title: productNom, text: 'Regarde ce produit sur ViralFlowr !', url });
        } else {
          navigator.clipboard.writeText(url);
          alert("Lien copié dans le presse-papier !");
        }
      }

      function goToCheckout() {
        const qty = document.getElementById('qty-input').value;
        const sep = PRODUCT.payBase.includes("?") ? "&" : "?";
        window.location.href = PRODUCT.payBase + sep + "qty=" + encodeURIComponent(qty);
      }

      // init
      updateQty(0);

      // expose globals for onclick
      window.updateQty = updateQty;
      window.shareProduct = shareProduct;
      window.goToCheckout = goToCheckout;
    </script>
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

  const payUrl = buildPayUrl({ ...p, img: imgRaw });
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
