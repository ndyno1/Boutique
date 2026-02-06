// scripts/generate-pages.mjs
import fs from "fs/promises";
import path from "path";

const SCRIPT_URL =
  process.env.VF_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbx_Tm3cGZs4oYdKmPieUU2SCjegAvn-BTufubyqZTFU4geAiRXN53YYE9XVGdq_uq1H/exec";

// Où écrire (racine du repo en général)
const OUT_DIR = process.env.OUT_DIR || ".";

// Le dossier des pages produit : /p/<id>/index.html
const P_DIR = process.env.P_DIR || "p";

// Token optionnel (si ton API renvoie des prix revendeur avec token)
const TOKEN = (process.env.VF_TOKEN || "").trim();

// Support WhatsApp fallback (si pas de template)
const WHATSAPP_SUPPORT = process.env.WHATSAPP_SUPPORT || "243850373991";

// Nettoyage optionnel (supprime les pages qui ne sont plus dans la liste)
const CLEAN = String(process.env.CLEAN || "").trim() === "1";

// =============== Helpers ===============
function safe(v) {
  return v === null || v === undefined ? "" : String(v);
}
function up(v) {
  return safe(v).trim().toUpperCase();
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
function sanitizeIdSegment(id) {
  // Important: doit être safe pour un dossier
  return safe(id).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}
function isLikelyJson(text) {
  const t = safe(text).trim();
  return t.startsWith("{") || t.startsWith("[");
}
function stripJsonp(text) {
  // Ex: callbackName({...});  ou  callbackName([...]);
  const t = safe(text).trim();

  // Cherche le premier "(" et le dernier ")"
  const i = t.indexOf("(");
  const j = t.lastIndexOf(")");
  if (i === -1 || j === -1 || j <= i) return null;

  const inside = t.slice(i + 1, j).trim();
  if (!isLikelyJson(inside)) return null;
  return inside;
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const txt = await res.text();
    return { ok: res.ok, status: res.status, text: txt };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProducts() {
  // 1) Essai JSON direct (sans callback)
  {
    const qs = new URLSearchParams({
      action: "get_products",
      t: String(Date.now()),
      ...(TOKEN ? { token: TOKEN } : {}),
    });
    const url = `${SCRIPT_URL}?${qs.toString()}`;
    const r = await fetchText(url);

    if (r.ok && isLikelyJson(r.text)) {
      const json = JSON.parse(r.text);
      const list = Array.isArray(json) ? json : Array.isArray(json?.products) ? json.products : [];
      return list;
    }
  }

  // 2) Fallback JSONP (avec callback)
  {
    const cb = "VF_NODE_CB";
    const qs = new URLSearchParams({
      action: "get_products",
      callback: cb,
      t: String(Date.now()),
      ...(TOKEN ? { token: TOKEN } : {}),
    });
    const url = `${SCRIPT_URL}?${qs.toString()}`;
    const r = await fetchText(url);

    if (!r.ok) {
      throw new Error(`API get_products non accessible (status ${r.status}).`);
    }

    const inside = stripJsonp(r.text);
    if (!inside) {
      // Souvent quand Apps Script renvoie une page HTML d’erreur
      const head = safe(r.text).slice(0, 200).replace(/\s+/g, " ");
      throw new Error(`Réponse API non-JSON/JSONP. Début: ${head}`);
    }

    const json = JSON.parse(inside);
    const list = Array.isArray(json) ? json : Array.isArray(json?.products) ? json.products : [];
    return list;
  }
}

function pId(p) {
  return safe(p.id || p.product_id || p.productId).trim();
}
function pName(p) {
  return safe(p.nom || p.name || p.title).trim();
}
function pCat(p) {
  return safe(p.cat || p.category || p.categorie).trim();
}
function pPrice(p) {
  return safe(
    p?.prix_affiche ??
    p?.prix_revendeur ??
    p?.RESELLER ?? p?.reseller ??
    p?.prix ??
    p?.price ??
    p?.amount ??
    p?.PV ?? p?.pv ??
    p?.prix_client
  ).trim();
}
function pImg(p) {
  return safe(p.img || p.image || p.photo).trim();
}
function pMin(p) {
  return safe(p.min || p.minqnt || p.minQty || p.min_qty).trim();
}
function pMax(p) {
  return safe(p.max || p.maxqnt || p.maxQty || p.max_qty).trim();
}

// =============== Template support ===============
async function readFirstExisting(paths) {
  for (const p of paths) {
    try {
      const content = await fs.readFile(p, "utf8");
      return { path: p, content };
    } catch (_) {}
  }
  return null;
}

function applyTemplate(tpl, product) {
  const id = pId(product);
  const name = pName(product) || `Produit ${id}`;
  const cat = pCat(product);
  const price = pPrice(product);
  const img = pImg(product);
  const min = pMin(product);
  const max = pMax(product);

  const productData = {
    id,
    name,
    cat,
    price,
    img,
    min,
    max,
    raw: product,
  };

  let out = tpl;

  // Remplacements classiques
  out = out.replaceAll("{{PRODUCT_ID}}", escHtml(id));
  out = out.replaceAll("__PRODUCT_ID__", escHtml(id));
  out = out.replaceAll("%%PRODUCT_ID%%", escHtml(id));

  out = out.replaceAll("{{PRODUCT_NAME}}", escHtml(name));
  out = out.replaceAll("__PRODUCT_NAME__", escHtml(name));

  out = out.replaceAll("{{PRODUCT_CATEGORY}}", escHtml(cat));
  out = out.replaceAll("{{PRODUCT_PRICE}}", escHtml(price));
  out = out.replaceAll("{{PRODUCT_IMAGE}}", escHtml(img));
  out = out.replaceAll("{{PRODUCT_MIN}}", escHtml(min));
  out = out.replaceAll("{{PRODUCT_MAX}}", escHtml(max));

  // Injection JSON (si placeholders existent)
  const jsonStr = JSON.stringify(productData, null, 2);
  out = out.replaceAll("{{VF_PRODUCT_DATA_JSON}}", jsonStr);
  out = out.replaceAll("__VF_PRODUCT_DATA_JSON__", jsonStr);

  // Si template a un marker <script id="vfProductData" type="application/json"></script>
  // on remplit son contenu
  out = out.replace(
    /(<script[^>]*id=["']vfProductData["'][^>]*type=["']application\/json["'][^>]*>)([\s\S]*?)(<\/script>)/i,
    `$1\n${jsonStr}\n$3`
  );

  // Si template a data-product-id=""
  out = out.replace(
    /data-product-id=["'][^"']*["']/gi,
    `data-product-id="${escHtml(id)}"`
  );

  // Bonus: titre
  out = out.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escHtml(name)} | ViralFlowr</title>`
  );

  return out;
}

function fallbackProductPage(product) {
  const id = pId(product);
  const seg = sanitizeIdSegment(id);

  const name = pName(product) || `Produit ${id}`;
  const cat = pCat(product) || "—";
  const price = pPrice(product) || "—";
  const img = pImg(product) || "https://cdn-icons-png.flaticon.com/512/11520/11520110.png";
  const min = pMin(product) || "";
  const max = pMax(product) || "";

  const waMsg = [
    "Bonjour, je veux commander sur ViralFlowr.",
    "",
    `Produit: ${name}`,
    `ID: ${id}`,
    `Catégorie: ${cat}`,
    `Prix: ${price}`,
    min || max ? `Quantité: (min ${min || "-"} / max ${max || "-"})` : "Quantité: 1",
    "",
    "Merci."
  ].join("\n");

  const waUrl = `https://wa.me/${WHATSAPP_SUPPORT}?text=${encodeURIComponent(waMsg)}`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${escHtml(name)} | ViralFlowr</title>
  <meta name="robots" content="index,follow"/>
  <meta name="description" content="${escHtml(name)} — ${escHtml(cat)} sur ViralFlowr"/>
  <link rel="icon" href="/favicon.png"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
  <style>
    body{font-family:Inter,sans-serif;background:#F8FAFC;color:#111827}
    .brand{background:linear-gradient(135deg,#F07E13 0%,#FFB26B 100%)}
  </style>
</head>
<body class="min-h-screen">
  <header class="sticky top-0 bg-white border-b border-gray-100">
    <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <a href="/index.html" class="text-2xl font-black tracking-tighter">Viral<span class="text-[#F07E13]">Flowr</span></a>
      <div class="flex gap-2">
        <a href="/index.html" class="px-4 h-10 inline-flex items-center rounded-xl border font-black text-xs uppercase tracking-widest">Boutique</a>
        <a href="/wallet.html" class="px-4 h-10 inline-flex items-center rounded-xl border font-black text-xs uppercase tracking-widest">Wallet</a>
      </div>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-10">
    <div class="grid md:grid-cols-2 gap-8">
      <div class="bg-white rounded-3xl border p-6">
        <img src="${escHtml(img)}" alt="${escHtml(name)}" class="w-full aspect-square object-contain rounded-2xl bg-[#F8FAFC] p-6"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/11520/11520110.png'"/>
      </div>
      <div class="bg-white rounded-3xl border p-6">
        <div class="text-[11px] font-black uppercase tracking-widest text-gray-400">${escHtml(cat)}</div>
        <h1 class="text-3xl font-black tracking-tight mt-2">${escHtml(name)}</h1>
        <div class="mt-4 text-2xl font-black">${escHtml(price)} <span class="text-gray-300">$</span></div>
        <div class="mt-3 text-sm font-bold text-gray-500">ID: <span class="font-black text-gray-800">${escHtml(id)}</span></div>

        ${(min || max) ? `<div class="mt-4 text-xs font-black uppercase tracking-widest text-gray-400">Min ${escHtml(min || "-")} • Max ${escHtml(max || "-")}</div>` : ``}

        <a href="${waUrl}" target="_blank" rel="noopener" class="mt-6 brand text-white font-black uppercase tracking-widest text-xs h-12 px-5 rounded-2xl inline-flex items-center justify-center">
          Commander (WhatsApp)
        </a>

        <div class="mt-4 text-xs font-semibold text-gray-500">
          (Fallback) Cette page est générée automatiquement. Si tu as un template produit, le script l’utilisera à la place.
        </div>
      </div>
    </div>
  </main>

  <footer class="py-10 text-center text-xs font-bold text-gray-300">
    © 2026 ViralFlowr
  </footer>
</body>
</html>`;
}

// =============== Main generate ===============
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listDirs(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (_) {
    return [];
  }
}

async function writeFileIfChanged(filePath, content) {
  try {
    const prev = await fs.readFile(filePath, "utf8");
    if (prev === content) return false;
  } catch (_) {}
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

async function main() {
  console.log(`[gen] SCRIPT_URL: ${SCRIPT_URL}`);
  console.log(`[gen] OUT_DIR: ${OUT_DIR}`);
  console.log(`[gen] P_DIR: ${P_DIR}`);
  console.log(`[gen] TOKEN: ${TOKEN ? "yes" : "no"}`);

  const repoRoot = path.resolve(process.cwd(), OUT_DIR);
  const pRoot = path.join(repoRoot, P_DIR);

  await ensureDir(pRoot);

  // Template optionnel (pour garder ta logique)
  const tpl = await readFirstExisting([
    path.join(repoRoot, "share", "product-template.html"),
    path.join(repoRoot, "share", "product.html"),
    path.join(repoRoot, "p", "_template.html"),
    path.join(repoRoot, "templates", "product.html"),
    path.join(repoRoot, "product-template.html"),
  ]);

  if (tpl) console.log(`[gen] Template trouvé: ${path.relative(repoRoot, tpl.path)}`);
  else console.log(`[gen] Aucun template trouvé -> fallback page.`);

  const products = await fetchProducts();
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("Liste produits vide. Vérifie action=get_products côté Apps Script.");
  }

  console.log(`[gen] Produits reçus: ${products.length}`);

  // Génération pages
  const wantedDirs = new Set();
  let writtenCount = 0;

  for (const p of products) {
    const id = pId(p);
    if (!id) continue;

    const seg = sanitizeIdSegment(id);
    wantedDirs.add(seg);

    const outDir = path.join(pRoot, seg);
    const outFile = path.join(outDir, "index.html");

    await ensureDir(outDir);

    const html = tpl
      ? applyTemplate(tpl.content, p)
      : fallbackProductPage(p);

    const changed = await writeFileIfChanged(outFile, html);
    if (changed) writtenCount++;
  }

  // Nettoyage optionnel
  if (CLEAN) {
    const existing = await listDirs(pRoot);
    for (const d of existing) {
      if (!wantedDirs.has(d)) {
        const full = path.join(pRoot, d);
        await fs.rm(full, { recursive: true, force: true });
        console.log(`[gen] Removed old: ${P_DIR}/${d}/`);
      }
    }
  }

  console.log(`[gen] Pages écrites/maj: ${writtenCount}`);
  console.log(`[gen] Exemple: ${P_DIR}/${[...wantedDirs][0] || "ID"}/index.html`);
}

main().catch((err) => {
  console.error("[gen] ERROR:", err?.stack || err?.message || err);
  process.exit(1);
});
