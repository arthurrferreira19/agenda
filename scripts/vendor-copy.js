/* scripts/vendor-copy.js
 * Copia assets de vendor (Bootstrap e Lucide) para /public/assets/vendor
 * para evitar dependência de CDNs (e problemas de CSP).
 */
const fs = require("fs");
const path = require("path");

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function readFile(p) { return fs.readFileSync(p, "utf8"); }
function writeFile(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, s, "utf8"); }

function copyFile(src, dst, transform) {
  if (!fs.existsSync(src)) {
    console.warn("[vendor-copy] Arquivo não encontrado:", src);
    return;
  }
  ensureDir(path.dirname(dst));
  if (!transform) {
    fs.copyFileSync(src, dst);
    return;
  }
  const out = transform(fs.readFileSync(src, "utf8"));
  fs.writeFileSync(dst, out, "utf8");
}

function stripSourceMap(text) {
  return String(text).replace(/\/\/# sourceMappingURL=.*$/gm, "").trim() + "\n";
}

const projectRoot = path.join(__dirname, "..");
const pubVendor = path.join(projectRoot, "public", "assets", "vendor");

console.log("[vendor-copy] Copiando vendor assets...");

const bsCssSrc = path.join(projectRoot, "node_modules", "bootstrap", "dist", "css", "bootstrap.min.css");
const bsJsSrc  = path.join(projectRoot, "node_modules", "bootstrap", "dist", "js", "bootstrap.bundle.min.js");

const bsCssDst = path.join(pubVendor, "bootstrap", "bootstrap.min.css");
const bsJsDst  = path.join(pubVendor, "bootstrap", "bootstrap.bundle.min.js");

copyFile(bsCssSrc, bsCssDst, stripSourceMap);
copyFile(bsJsSrc,  bsJsDst,  stripSourceMap);

// Lucide UMD
const lucideSrc = path.join(projectRoot, "node_modules", "lucide", "dist", "umd", "lucide.min.js");
const lucideDst = path.join(pubVendor, "lucide", "lucide.min.js");
copyFile(lucideSrc, lucideDst, stripSourceMap);

console.log("[vendor-copy] OK");
