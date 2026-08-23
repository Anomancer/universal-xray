const BHC_PROFILE = "static";
const CACHE_VERSION = "bhc-universal-x-ray-static-v1";
const CORE_CACHE = CACHE_VERSION + "-core";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";
const OFFLINE_URL = "/offline.html";
const CORE = ["/", "/manifest.webmanifest", OFFLINE_URL, "/icon-192.png", "/icon-512.png"];
const MEDIA_EXT = /\.(?:mp4|webm|mov|m4v|mp3|wav|flac|ogg|m4a)(?:\?|$)/i;
const STATIC_EXT = /\.(?:css|js|mjs|json|png|jpg|jpeg|webp|svg|gif|woff2?|ttf|ico)(?:\?|$)/i;
self.addEventListener("install", event => { event.waitUntil(caches.open(CORE_CACHE).then(cache => Promise.allSettled(CORE.map(url => cache.add(url)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("bhc-") && ![CORE_CACHE,RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function networkFirst(request){try{const response=await fetch(request);if(response&&response.ok&&request.url.startsWith(self.location.origin)){const c=await caches.open(RUNTIME_CACHE);c.put(request,response.clone()).catch(()=>{});}return response;}catch{return (await caches.match(request))||(request.mode==="navigate"?caches.match(OFFLINE_URL):Response.error());}}
async function cacheFirst(request){const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response&&response.ok&&request.url.startsWith(self.location.origin)){const c=await caches.open(RUNTIME_CACHE);c.put(request,response.clone()).catch(()=>{});}return response;}
async function staleWhileRevalidate(request){const c=await caches.open(RUNTIME_CACHE);const cached=await c.match(request);const net=fetch(request).then(r=>{if(r&&r.ok&&request.url.startsWith(self.location.origin))c.put(request,r.clone()).catch(()=>{});return r;}).catch(()=>null);return cached||net||(request.mode==="navigate"?caches.match(OFFLINE_URL):Response.error());}
self.addEventListener("fetch", event => { const r=event.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;if(BHC_PROFILE==="media"&&MEDIA_EXT.test(u.pathname)){event.respondWith(fetch(r).catch(()=>caches.match(r)));return;}if(r.mode==="navigate"){event.respondWith(BHC_PROFILE==="static"?staleWhileRevalidate(r):networkFirst(r));return;}if(STATIC_EXT.test(u.pathname)){event.respondWith(BHC_PROFILE==="static"?cacheFirst(r):staleWhileRevalidate(r));return;}event.respondWith(networkFirst(r)); });
