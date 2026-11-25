// Multi-page test site: nav tabs (full page loads), a query-string page, a cross-origin iframe, and an SPA with client-side tabs.
const http = require("http");
const nav = `<nav><a id="t-home" href="/">Home</a> <a id="t-news" href="/news">News</a> <a id="t-sport" href="/sport">Sport</a> <a id="t-search" href="/search?q=weather&page=2">Search</a> <a id="t-app" href="/app">App</a></nav>`;
const page = (title, extra = "") => `<!doctype html><html><head><title>${title}</title></head><body>${nav}<h1>${title}</h1>
<img src="/hero.svg?t=${title}" width="800" height="300" alt="">
<p>${"Lorem ipsum dolor sit amet. ".repeat(40)}</p>${extra}</body></html>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" fill="#88a"/></svg>`;
const spa = `<!doctype html><html><head><title>App</title></head><body>${nav}<h1 id="h">App: overview</h1>
<button id="tab-a" onclick="go('reports')">Reports</button><button id="tab-b" onclick="go('settings')">Settings</button>
<div id="c">${"Content. ".repeat(80)}</div>
<script>function go(t){history.pushState({},'', '/app/'+t);document.getElementById('h').textContent='App: '+t;document.getElementById('c').textContent=('Tab '+t+'. ').repeat(80);}</script></body></html>`;
function server(port, handler) { http.createServer(handler).listen(port, () => console.log("listening", port)); }
server(8101, (req, res) => {
  const u = new URL(req.url, "http://x");
  const delay = { "/news": 120, "/sport": 60, "/search": 200 }[u.pathname] ?? 30;
  setTimeout(() => {
    if (u.pathname === "/hero.svg") { res.setHeader("content-type", "image/svg+xml"); return res.end(svg); }
    res.setHeader("content-type", "text/html");
    if (u.pathname === "/") return res.end(page("Home", `<iframe src="http://127.0.0.1:8102/ad" width="300" height="120"></iframe>`));
    if (u.pathname === "/news") return res.end(page("News"));
    if (u.pathname === "/sport") return res.end(page("Sport"));
    if (u.pathname === "/search") return res.end(page("Search results"));
    if (u.pathname.startsWith("/app")) return res.end(spa);
    res.statusCode = 404; res.end("not found");
  }, delay);
});
// "Third-party" origin serving an iframe
server(8102, (req, res) => { res.setHeader("content-type", "text/html"); res.end(`<!doctype html><body style="margin:0;background:#fc0"><h3>Ad</h3><p>${"ad ".repeat(30)}</p></body>`); });
