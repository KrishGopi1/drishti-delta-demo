// Local preview: serves the site and proxies /eox/* to EOX exactly like vercel.json does.
// Usage: node dev-server.js   then open http://localhost:5173
const http = require("http"), https = require("https"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 5173, ROOT = __dirname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain" };
const ISO = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "credentialless" };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/eox/")) {
    const up = https.get("https://tiles.maps.eox.at" + url.pathname.slice(4) + url.search, { headers: { "User-Agent": "drishti-delta-dev" } }, (r) => {
      res.writeHead(r.statusCode, { "Content-Type": r.headers["content-type"] || "image/jpeg", "Cache-Control": "public, max-age=86400", ...ISO });
      r.pipe(res);
    });
    up.on("error", () => { res.writeHead(502); res.end("upstream error"); });
    return;
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (!p) p = "index.html";
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", ...ISO });
    res.end(data);
  });
}).listen(PORT, () => console.log(`DRISHTI-Δ demo on http://localhost:${PORT}`));
