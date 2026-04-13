const BASE_URL = '/pokesleep-tool/';
const CACHE_VERSION = 'v3';
const APP_CACHE = `pokesleep-tool-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pokesleep-tool-runtime-${CACHE_VERSION}`;

const ENTRY_PAGES = [
    'index.html',
    'index.ja.html',
    'index.ko.html',
    'index.zh-cn.html',
    'index.zh-tw.html',
    'iv/index.html',
    'iv/index.ja.html',
    'iv/index.ko.html',
    'iv/index.zh-cn.html',
    'iv/index.zh-tw.html',
].map(path => new URL(path, self.location.origin + BASE_URL).toString());

const PRECACHE_URLS = [
    ...ENTRY_PAGES,
    new URL('manifest.en.json', self.location.origin + BASE_URL).toString(),
    new URL('manifest.ja.json', self.location.origin + BASE_URL).toString(),
    new URL('manifest.ko.json', self.location.origin + BASE_URL).toString(),
    new URL('manifest.zh-cn.json', self.location.origin + BASE_URL).toString(),
    new URL('manifest.zh-tw.json', self.location.origin + BASE_URL).toString(),
    new URL('iv/manifest.en.json', self.location.origin + BASE_URL).toString(),
    new URL('iv/manifest.ja.json', self.location.origin + BASE_URL).toString(),
    new URL('iv/manifest.ko.json', self.location.origin + BASE_URL).toString(),
    new URL('iv/manifest.zh-cn.json', self.location.origin + BASE_URL).toString(),
    new URL('iv/manifest.zh-tw.json', self.location.origin + BASE_URL).toString(),
    new URL('favicon.svg', self.location.origin + BASE_URL).toString(),
    new URL('logo192.png', self.location.origin + BASE_URL).toString(),
    new URL('robots.txt', self.location.origin + BASE_URL).toString(),
];

function isSameOriginGet(request) {
    const url = new URL(request.url);
    return request.method === 'GET' && url.origin === self.location.origin;
}

function isHtmlRequest(request) {
    return request.mode === 'navigate' || request.destination === 'document';
}

async function cacheUrl(cache, url) {
    const response = await fetch(url, {cache: 'no-store'});
    if (response.ok) {
        await cache.put(url, response.clone());
    }
    return response;
}

async function cacheLinkedAssets(cache, htmlText, pageUrl) {
    const urls = new Set();
    const re = /(?:src|href)=["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(htmlText)) !== null) {
        const raw = match[1];
        if (
            raw.startsWith('data:') ||
            raw.startsWith('mailto:') ||
            raw.startsWith('javascript:') ||
            raw.startsWith('#')
        ) {
            continue;
        }
        const resolved = new URL(raw, pageUrl).toString();
        if (new URL(resolved).origin === self.location.origin) {
            urls.add(resolved);
        }
    }
    await Promise.all([...urls].map(url => cacheUrl(cache, url)));
}

async function precacheAppShell() {
    const cache = await caches.open(APP_CACHE);
    await Promise.all(PRECACHE_URLS.map(url => cacheUrl(cache, url)));

    // Cache the assets referenced by the HTML entry points so the app can
    // restart offline after it has been opened once.
    for (const pageUrl of ENTRY_PAGES) {
        const response = await fetch(pageUrl, {cache: 'no-store'});
        if (!response.ok) {
            continue;
        }
        const html = await response.text();
        await cache.put(pageUrl, new Response(html, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        }));
        await cacheLinkedAssets(cache, html, pageUrl);
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request, {ignoreSearch: true});
        if (cached !== undefined) {
            return cached;
        }
        if (request.mode === 'navigate') {
            return (await caches.match(new URL('index.html', self.location.origin + BASE_URL).toString(), {ignoreSearch: true})) ??
                Response.error();
        }
        return Response.error();
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached !== undefined) {
        return cached;
    }
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        await precacheAppShell();
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => {
            if (
                key.startsWith('pokesleep-tool-') &&
                key !== APP_CACHE &&
                key !== RUNTIME_CACHE
            ) {
                return caches.delete(key);
            }
            return Promise.resolve(false);
        }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (!isSameOriginGet(event.request)) {
        return;
    }

    if (isHtmlRequest(event.request)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(cacheFirst(event.request));
});
