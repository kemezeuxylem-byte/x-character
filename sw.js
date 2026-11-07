/* Offline support for X-Character Prompt Creator */
const APP_CACHE = "x-character-app-v2";
const FONT_CACHE = "x-character-fonts-v1";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,500..800&family=DM+Mono:wght@400;500&display=swap";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"];

/* Fonts are saved when possible. The app still works with system fonts if they cannot be saved. */
async function saveFonts() {
  try {
    const cache = await caches.open(FONT_CACHE);
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    const css = await res.clone().text();
    await cache.put(FONT_CSS, res);
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(async u => { const r = await fetch(u); if (r.ok) await cache.put(u, r); }));
  } catch (e) {}
}
self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = [APP_CACHE, FONT_CACHE];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
    await saveFonts();
  })());
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(r.url);
      if (hit) return hit;
      const res = await fetch(r.url);
      if (res.ok) await cache.put(r.url, res.clone());
      return res;
    })());
    return;
  }
  if (u.origin !== location.origin) return;
  /* Time checks for access codes always go to the web server. */
  if (u.searchParams.has("now")) return;
  /* Open from the saved copy straight away, and refresh the copy in the background so updates arrive on the next launch. */
  e.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const key = r.mode === "navigate" ? "./index.html" : r;
    const hit = await cache.match(key, {ignoreSearch: true});
    const fresh = fetch(r).then(res => { if (res.ok && res.type === "basic") cache.put(key, res.clone()); return res; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  })());
});
