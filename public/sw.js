// Service worker de La Letra: deja instalar la app y abrirla aunque se vaya el internet.
// No guarda datos del negocio (eso lo hace la app con Firestore y su copia local).
const VERSION = "laletra-v1";
const SHELL = "shell-" + VERSION;
const ASSETS = "assets-" + VERSION;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Solo lo propio del sitio: Firebase, Google (inicio de sesión) y fuentes pasan directo.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/__/") || url.pathname.startsWith("/api/")) return;

  // Pantalla principal: primero internet (así siempre sale la versión nueva); sin internet, la última guardada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Archivos con nombre único (assets): una vez guardados no cambian.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Íconos, manifiesto y demás: internet primero, copia si no hay.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});
