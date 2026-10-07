/* =========================================================
   BIZPILOT — SERVICE WORKER
   Makes the app installable and improves offline loading
   ========================================================= */

const CACHE_NAME = "bizpilot-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];

/* Install */
self.addEventListener("install", function (event) {

    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});


/* Activate */
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


/* Fetch */
self.addEventListener("fetch", function (event) {

    /*
     * Let Supabase and other external services
     * continue using the normal network.
     */
    if (
        !event.request.url.startsWith(self.location.origin)
    ) {
        return;
    }

    /*
     * For pages, try the network first.
     * If offline, use the cached version.
     */
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

                    return caches.match(
                        event.request
                    ).then(function (cached) {

                        return cached ||
                            caches.match("./index.html");

                    });

                })
        );

        return;
    }

    /*
     * For CSS, JS, images and other local files:
     * use cache when available, otherwise network.
     */
    event.respondWith(

        caches.match(event.request)
            .then(function (cached) {

                return cached ||
                    fetch(event.request).then(function (response) {

                        if (
                            response &&
                            response.status === 200 &&
                            response.type === "basic"
                        ) {

                            const copy =
                                response.clone();

                            caches.open(CACHE_NAME)
                                .then(function (cache) {
                                    cache.put(
                                        event.request,
                                        copy
                                    );
                                });

                        }

                        return response;

                    });

            })

    );

});