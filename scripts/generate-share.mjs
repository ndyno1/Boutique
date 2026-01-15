import fs from "fs";
import path from "path";
import { createCanvas, loadImage, registerFont } from "canvas";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCvuy-WiLMlAkBb7k6YyPVMk4lQhGGke05heSWSw--twKE2L-oVSOs884g3jn6lt6m/exec";
const SITE_URL = "https://viralflowr.com";

const OUT_SHARE = path.resolve("share");
const OUT_OG = path.resolve("og");

// (Optionnel) police: si tu ajoutes un .ttf dans assets/fonts/Inter-Bold.ttf
// try { registerFont("assets/fonts/Inter-Bold.ttf", { family: "InterBold" }); } catch {}

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function safeStr(v){ return (v === null || v === undefined) ? "" : String(v); }
function up(v){ return safeStr(v).trim().toUpperCase(); }

function escapeHtml(s){
  return safeStr(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines=3){
  const words = safeStr(text).split(/\s+/);
  let line = "";
  let lines = [];
  for (const w of words){
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.length > 0){
    // ajoute "…" si trop long
    const last = lines[lines.length-1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 10){
      lines[lines.length-1] = lines[lines.length-1].slice(0, -1);
    }
    lines[lines.length-1] = lines[lines.length-1] + "…";
  }
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i*lineHeight));
  return y + lines.length*lineHeight;
}

async function fetchProducts(){
  // Ton endpoint renvoie JSONP : callback([...])
  const cb = "cb_" + Date.now();
  const url = `${SCRIPT_URL}?action=get_products&cat=all&callback=${cb}&t=${Date.now()}`;
  const res = await fetch(url);
  const txt = await res.text();

  const start = txt.indexOf("(");
  const end = txt.lastIndexOf(")");
  if (start === -1 || end === -1) throw new Error("JSONP invalide");
  const json = txt.slice(start+1, end);

  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Liste produits invalide");
  return data;
}

function buildCheckoutUrl(p){
  // Tu gardes ta logique actuelle: paiement.html?nom=...&prix=...&cat=...&id=...&min/max...
  const qp = new URLSearchParams();
  qp.set("nom", safeStr(p.nom));
  qp.set("prix", safeStr(p.prix));
  qp.set("cat", safeStr(p.cat));
  qp.set("id", safeStr(p.id));
  qp.set("min", safeStr(p.min));
  qp.set("max", safeStr(p.max));
  qp.set("desc", safeStr(p.desc || p.description || ""));
  qp.set("long", safeStr(p.long_desc || p.long || ""));
  return `${SITE_URL}/paiement.html?${qp.toString()}`;
}

function buildShareHtml(p, ogImageUrl){
  const id = safeStr(p.id).trim();
  const name = escapeHtml(p.nom);
  const cat = escapeHtml(p.cat);
  const price = safeStr(p.prix);
  const desc = escapeHtml(`Prix: ${price}$ • Cat: ${safeStr(p.cat)} • ViralFlowr`);

  const shareUrl = `${SITE_URL}/share/${encodeURIComponent(id)}`;
  const checkoutUrl = buildCheckoutUrl(p);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} | ViralFlowr</title>
  <meta name="description" content="${desc}">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ViralFlowr">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:url" content="${shareUrl}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${name}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <meta http-equiv="refresh" content="0;url=${checkoutUrl}">
</head>
<body>
  <a href="${checkoutUrl}">Ouvrir le produit</a>
</body>
</html>`;
}

async function generateOgImage(p){
  // Image style “Spotify-ish”: 1200x630
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Fond gradient orange
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, "#F07E13");
  grad.addColorStop(1, "#FFB26B");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // Card sombre
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 60, 60, W-120, H-120, 36);
  ctx.fill();

  // Petit badge
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundRect(ctx, 90, 95, 220, 46, 16);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "800 20px Inter, Arial";
  ctx.fillText(up(p.cat || "PRODUIT"), 110, 126);

  // Logo
  ctx.font = "900 34px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("ViralFlowr", 90, 185);

  // Titre
  ctx.font = "900 54px Inter, Arial";
  ctx.fillStyle = "white";
  let y = 265;
  y = wrapText(ctx, safeStr(p.nom), 90, y, 740, 64, 3);

  // Prix
  ctx.font = "900 46px Inter, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(`${safeStr(p.prix)} $`, 90, H - 115);

  // Image produit à droite
  const imgUrl = safeStr(p.img).trim();
  if (imgUrl.startsWith("http")){
    try{
      const img = await loadImage(imgUrl);
      const boxX = 860, boxY = 160, boxS = 330;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, boxX, boxY, boxS, boxS, 28);
      ctx.fill();

      // cover contain
      const scale = Math.min(boxS / img.width, boxS / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      const ix = boxX + (boxS - iw)/2;
      const iy = boxY + (boxS - ih)/2;
      ctx.drawImage(img, ix, iy, iw, ih);
    }catch{
      // ignore
    }
  }

  return canvas.toBuffer("image/png");
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

async function main(){
  ensureDir(OUT_SHARE);
  ensureDir(OUT_OG);

  const products = await fetchProducts();

  for (const p of products){
    const id = safeStr(p.id).trim();
    if (!id) continue;

    // OG image
    const ogPath = path.join(OUT_OG, `${id}.png`);
    const ogUrl = `${SITE_URL}/og/${encodeURIComponent(id)}.png`;

    const buf = await generateOgImage(p);
    fs.writeFileSync(ogPath, buf);

    // Share page
    const dir = path.join(OUT_SHARE, id);
    ensureDir(dir);

    const html = buildShareHtml(p, ogUrl);
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  }

  console.log(`✅ Généré: ${products.length} produits -> /share/* + /og/*.png`);
}

main().catch(err => {
  console.error("❌", err);
  process.exit(1);
});
