/* =========================================================
   BIZPILOT — SERVICE WORKER
   ========================================================= */

const CACHE_NAME = "bizpilot-v3";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

/* INSTALL */
self.addEventListener("install", function (event) {

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});


/* ACTIVATE */
self.addEventListener("activate", function (event) {

    event.waitUntil(
        caches.keys().then(function (cacheNames) {

            return Promise.all(
                cacheNames
                    .filter(function (name) {
                        return name !== CACHE_NAME;
                    })
                    .map(function (name) {
                        return caches.delete(name);
                    })
            );

        })
    );

    self.clients.claim();
});


/* FETCH */
self.addEventListener("fetch", function (event) {

    /* Keep external services such as Supabase on the network */
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    /* Pages */
    if (event.request.mode === "navigate") {

        event.respondWith(

            fetch(event.request)
                .then(function (response) {

                    const copy = response.clone();

                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, copy);
                    });

                    return response;

                })
                .catch(function () {

                    return caches.match(event.request).then(function (cached) {

                        return cached || caches.match("./index.html");

                    });

                })
        );

        return;
    }

    /* CSS, JS, images and other local files */
    event.respondWith(

        caches.match(event.request)
            .then(function (cached) {

                return cached || fetch(event.request).then(function (response) {

                    if (
                        response &&
                        response.status === 200 &&
                        response.type === "basic"
                    ) {

                        const copy = response.clone();

                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(event.request, copy);
                        });

                    }

                    return response;

                });

            })

    );

});