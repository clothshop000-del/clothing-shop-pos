// Tiny local web server (no packages needed). Run:  node server.js   ->  http://localhost:3000
const http = require("http"), fs = require("fs"), path = require("path");
const root = __dirname, port = process.env.PORT || 3000;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || /server\.js$|\.sql$|\.md$/.test(f)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(d);
  });
}).listen(port, () => console.log("Clothing Shop POS running -> http://localhost:" + port));
