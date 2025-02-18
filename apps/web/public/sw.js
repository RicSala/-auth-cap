// @ts-nocheck

/// <reference lib="webworker" />

// This service worker provides offline functionality by serving a fallback page when network requests fail

// Import Workbox library from Google CDN
// Workbox is a set of libraries that simplify common service worker operations
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js'
);

// Define a cache name for storing offline resources
// This name can be used to version your cache and manage updates
const CACHE = 'test-pwa';

// Path to the offline fallback page
// This page will be shown when a user is offline and a page request fails
const offlineFallbackPage = '/offline';

// Listen for messages from the main thread
// This is commonly used for triggering service worker updates
/**
 * @param {ExtendableMessageEvent} event
 */
self.addEventListener('message', (event) => {
  // Check if the message is requesting the service worker to skip waiting
  // This is part of the update process to activate a new service worker immediately
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Activate the new service worker immediately
  }
});

// Installation event
// This runs when the service worker is first installed or when it's updated
/**
 * @param {ExtendableEvent} event
 */
self.addEventListener('install', async (event) => {
  // waitUntil() tells the browser to keep the service worker in the "installing"
  // phase until the passed promise resolves
  event.waitUntil(
    // Open (or create) a cache with our cache name
    caches
      .open(CACHE)
      // Once the cache is open, add our offline page to it
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

// Enable navigation preload if supported by the browser
// Navigation preload starts loading resources while the service worker is starting up
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Fetch event listener
// This runs whenever the browser makes a network request
/**
 * @param {FetchEvent} event
 */
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (full page loads)
  // Ignore other requests like API calls or static resources
  if (event.request.mode === 'navigate') {
    // respondWith() tells the browser we'll handle this request
    event.respondWith(
      // Use an async IIFE (Immediately Invoked Function Expression)
      (async () => {
        try {
          // First, try to get the preloaded response
          // This is the response that might have been preloaded during navigation
          const preloadResp = await event.preloadResponse;

          // If we have a preloaded response, use it
          if (preloadResp) {
            return preloadResp;
          }

          // If no preloaded response, try the network
          const networkResp = await fetch(event.request);
          return networkResp;
        } catch (error) {
          // If both preload and network fail (user is offline)
          // Open our cache
          const cache = await caches.open(CACHE);
          // Get the cached offline page
          const cachedResp = await cache.match(offlineFallbackPage);
          // Return the offline page
          return cachedResp;
        }
      })()
    );
  }
});
